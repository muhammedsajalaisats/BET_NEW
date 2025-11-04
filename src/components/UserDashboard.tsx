import { useState, useEffect } from 'react';
import { LogOut, Plane, Power, StopCircle, AlertCircle, RefreshCw, Battery } from 'lucide-react';
import { supabase, BETRecord, ChargingLog, UserProfile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import queryString from 'query-string';

interface Equipment extends BETRecord {
  id: string;
}

interface SwappingLog {
  id: number;
  created_at: string;
  User_id: string;
  location_id: string;
  equipment_id: string;
  Count: string;
}

export default function UserDashboard() {
  const { profile, signOut } = useAuth();
  const [selectedEquipment, setSelectedEquipment] = useState<BETRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<ChargingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<ChargingLog[]>([]);
  const [totalSwapCount, setTotalSwapCount] = useState<number>(0);
  const [operationLoading, setOperationLoading] = useState(false);
  const [swappingLoading, setSwappingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swappingSuccess, setSwappingSuccess] = useState<string | null>(null);

  // Parse query parameters and handle equipment selection
  useEffect(() => {
    const params = queryString.parse(window.location.search);
    const equipmentNo = params.EquipmentNo as string;
    
    fetchEquipment(equipmentNo);
  }, [window.location.search]);

  // Fetch equipment current session and logs when equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      fetchCurrentSession();
      fetchLogs();
      fetchTotalSwapCount();

      // Subscribe to charging log changes for this equipment
      const chargingChannel = supabase
        .channel(`charging_logs_${selectedEquipment.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'charging_logs',
            filter: `equipment_id=eq.${selectedEquipment.id}`,
          },
          () => {
            fetchCurrentSession();
            fetchLogs();
          }
        )
        .subscribe();

      // Subscribe to swapping log changes for this equipment
      const swappingChannel = supabase
        .channel(`swapping_logs_${selectedEquipment.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'swapping_log',
            filter: `equipment_id=eq.${selectedEquipment.id}`,
          },
          () => {
            fetchTotalSwapCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chargingChannel);
        supabase.removeChannel(swappingChannel);
      };
    }
  }, [selectedEquipment?.id]);

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

  const fetchCurrentSession = async () => {
    if (!selectedEquipment) return;
    
    try {
      // Get the most recent session for this equipment where end_time is NULL
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', selectedEquipment.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentSession(data || null);
    } catch (error) {
      console.error('Error fetching current session:', error);
      setCurrentSession(null);
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

  const fetchTotalSwapCount = async () => {
    if (!selectedEquipment) return;
    try {
      const { data, error, count } = await supabase
        .from('swapping_log')
        .select('*', { count: 'exact', head: true })
        .eq('equipment_id', selectedEquipment.id);

      if (error) throw error;
      setTotalSwapCount(count || 0);
    } catch (error) {
      console.error('Error fetching total swap count:', error);
      setTotalSwapCount(0);
    }
  };

  const startCharging = async () => {
    if (!selectedEquipment || !profile) {
      setError('No equipment selected or user not authenticated');
      return;
    }

    // Check if user has charging access
    if (!profile.Charging_Access) {
      setError('You do not have permission to start charging');
      return;
    }

    // Check if equipment already has an active session (safety check)
    await fetchCurrentSession();
    if (currentSession) {
      setError('Equipment is already charging');
      return;
    }

    setOperationLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .insert([{
          equipment_id: selectedEquipment.id,
          user_id: profile.id,
          location_id: selectedEquipment.location_id,
          start_time: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately
      setCurrentSession(data);
      
    } catch (err: any) {
      console.error('Error starting charging:', err);
      setError(err.message || 'Failed to start charging');
    } finally {
      setOperationLoading(false);
    }
  };

  const stopCharging = async () => {
    if (!currentSession || !profile) {
      setError('No active charging session or user not authenticated');
      return;
    }

    // Check if user has charging access
    if (!profile.Charging_Access) {
      setError('You do not have permission to stop charging');
      return;
    }

    setOperationLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('charging_logs')
        .update({
          end_time: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      // Update local state immediately
      setCurrentSession(null);
      
    } catch (err: any) {
      console.error('Error stopping charging:', err);
      setError(err.message || 'Failed to stop charging');
    } finally {
      setOperationLoading(false);
    }
  };

  const recordBatterySwap = async () => {
    if (!selectedEquipment || !profile) {
      setError('No equipment selected or user not authenticated');
      return;
    }

    // Check if user has swapping access
    if (!profile.Swapping_Access) {
      setError('You do not have permission to record battery swaps');
      return;
    }

    setSwappingLoading(true);
    setError('');
    setSwappingSuccess(null);

    try {
      // Insert new swapping log with count = 1
      const { error: insertError } = await supabase
        .from('swapping_log')
        .insert([{
          User_id: profile.id,
          location_id: selectedEquipment.location_id,
          equipment_id: selectedEquipment.id,
          Count: '1',
        }]);

      if (insertError) throw insertError;

      setSwappingSuccess('Battery swap recorded successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSwappingSuccess(null);
      }, 3000);

      // Refresh total count
      fetchTotalSwapCount();
      
    } catch (err: any) {
      console.error('Error recording battery swap:', err);
      setError(err.message || 'Failed to record battery swap');
    } finally {
      setSwappingLoading(false);
    }
  };

  // Determine button state based on equipment's current session
  const isEquipmentCharging = currentSession !== null;

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
                <div className="flex gap-2 mt-1">
                  {profile?.Charging_Access && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Charging</span>
                  )}
                  {profile?.Swapping_Access && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Swapping</span>
                  )}
                </div>
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
                  setCurrentSession(null); // Reset session when equipment changes
                  
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
                  <p className="text-xs text-gray-400 mt-1">
                    Status: {selectedEquipment.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isEquipmentCharging ? (
                    <button
                      onClick={stopCharging}
                      disabled={operationLoading || !profile?.Charging_Access}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      <StopCircle className="w-5 h-5" />
                      {operationLoading ? 'Stopping...' : 'Stop Charging'}
                    </button>
                  ) : (
                    <button
                      onClick={startCharging}
                      disabled={operationLoading || !profile?.Charging_Access}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      <Power className="w-5 h-5" />
                      {operationLoading ? 'Starting...' : 'Start Charging'}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {swappingSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-700">{swappingSuccess}</p>
                </div>
              )}

              {currentSession && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Currently Charging</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Started: {new Date(currentSession.start_time).toLocaleString()}
                      </p>
                      {currentSession.user_id && (
                        <p className="text-xs text-blue-600 mt-1">
                          Started by: {currentSession.user_id === profile?.id ? 'You' : 'Another user'}
                        </p>
                      )}
                    </div>
                    <div className="animate-pulse">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Battery Swapping Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                      <Battery className="w-5 h-5 text-amber-600" />
                      Battery Swapping
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Total swaps: {totalSwapCount}
                    </p>
                  </div>
                  <button
                    onClick={recordBatterySwap}
                    disabled={swappingLoading || !profile?.Swapping_Access}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 ${swappingLoading ? 'animate-spin' : ''}`} />
                    {swappingLoading ? 'Recording...' : 'Record Swap'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}