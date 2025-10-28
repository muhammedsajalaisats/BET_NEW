import { useState, useEffect } from 'react';
import { LogOut, Plane, Power, StopCircle, AlertCircle, History as HistoryIcon } from 'lucide-react';
import { supabase, BETRecord, ChargingLog } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import queryString from 'query-string';

interface Equipment extends BETRecord {
  id: string;
}

export default function UserDashboard() {
  const { profile, signOut } = useAuth();
  const [selectedEquipment, setSelectedEquipment] = useState<BETRecord | null>(null);
  const [currentLog, setCurrentLog] = useState<ChargingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<ChargingLog[]>([]);

  // Parse query parameters and handle equipment selection
  useEffect(() => {
    const params = queryString.parse(window.location.search);
    const equipmentNo = params.EquipmentNo as string;
    
    fetchEquipment(equipmentNo);
  }, [window.location.search]);

  useEffect(() => {
    if (selectedEquipment) {
      fetchCurrentLog();
      fetchLogs();

      // Subscribe to charging log changes
      const channel = supabase
        .channel('charging_logs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'charging_logs',
            filter: `equipment_id=eq.${selectedEquipment.id}`,
          },
          () => {
            fetchCurrentLog();
            fetchLogs();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedEquipment?.id]);

  const [error, setError] = useState<string | null>(null);

  const fetchAllEquipment = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('bet_records')
        .select('*')
        .eq('location_id', profile?.location_id);

      if (fetchError) throw fetchError;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching all equipment:', error);
      setError('Failed to fetch equipment list');
    }
  };

  useEffect(() => {
    fetchAllEquipment();
  }, [profile?.location_id]);

  const fetchEquipment = async (equipmentNo?: string) => {
    if (!equipmentNo) {
      setQueryError('Equipment number is required');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('bet_records')
        .select('*')
        .eq('location_id', profile?.location_id)
        .eq('status', 'operational')
        .eq('equipment_id', equipmentNo)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setQueryError(`Equipment ${equipmentNo} not found or not accessible`);
        setSelectedEquipment(null);
      } else {
        setSelectedEquipment(data);
        setQueryError(null);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setQueryError('Failed to fetch equipment');
      setSelectedEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentLog = async () => {
    if (!selectedEquipment) return;
    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', selectedEquipment.id)
        .is('end_time', null)
        .maybeSingle();

      if (error) throw error;
      setCurrentLog(data);
    } catch (error) {
      console.error('Error fetching current log:', error);
    }
  };

  const fetchLogs = async () => {
    if (!selectedEquipment) return;
    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', selectedEquipment.id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const startCharging = async () => {
    if (!selectedEquipment || !profile) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('charging_logs')
        .insert([{
          equipment_id: selectedEquipment.id,
          user_id: profile.id,
          location_id: selectedEquipment.location_id,
          start_time: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to start charging');
    } finally {
      setLoading(false);
    }
  };

  const stopCharging = async () => {
    if (!currentLog || !profile) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('charging_logs')
        .update({
          end_time: new Date().toISOString(),
        })
        .eq('id', currentLog.id);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to stop charging');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">BET Tracker</h1>
                <p className="text-xs text-gray-500">Air India SATS</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          {queryError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{queryError}</p>
              </div>
            </div>
          )}
          
          {!queryString.parse(window.location.search).EquipmentNo && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Equipment
              </label>
              <select
                value={selectedEquipment?.id || ''}
                onChange={(e) => {
                  const selected = equipment.find(eq => eq.id === e.target.value);
                  setSelectedEquipment(selected || null);
                  // Update URL with equipment number
                  if (selected) {
                    const newUrl = queryString.stringifyUrl({
                      url: window.location.pathname,
                      query: { EquipmentNo: selected.equipment_id }
                    });
                    window.history.pushState({}, '', newUrl);
                  }
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select Equipment</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.equipment_id} - {eq.equipment_type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedEquipment && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedEquipment.equipment_id}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedEquipment.equipment_type}</p>
                </div>
                {queryString.parse(window.location.search).EquipmentNo && (
                  <button
                    onClick={() => {
                      setSelectedEquipment(null);
                      window.history.pushState({}, '', window.location.pathname);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Clear Selection
                  </button>
                )}
                <div className="flex items-center gap-3">
                  {!currentLog ? (
                    <button
                      onClick={startCharging}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Power className="w-5 h-5" />
                      Start Charging
                    </button>
                  ) : (
                    <button
                      onClick={stopCharging}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <StopCircle className="w-5 h-5" />
                      Stop Charging
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {currentLog && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900">Currently Charging</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Started: {new Date(currentLog.start_time).toLocaleString()}
                  </p>
                </div>
              )}

              {logs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4" />
                    Recent Charging History
                  </h4>
                  <div className="space-y-3">
                    {logs.map(log => (
                      <div
                        key={log.id}
                        className="text-sm border border-gray-100 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">
                            Duration: {log.duration_minutes ? `${Math.round(log.duration_minutes)} minutes` : 'In Progress'}
                          </p>
                          <p className="text-gray-500">
                            {new Date(log.start_time).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Start: {new Date(log.start_time).toLocaleTimeString()}</span>
                            {log.end_time && (
                              <span>End: {new Date(log.end_time).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}