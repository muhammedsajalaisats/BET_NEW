import { useState, useEffect } from 'react';
import { Power, StopCircle, HistoryIcon, BatteryCharging } from 'lucide-react';
import { supabase, BETRecord, ChargingLog } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChargingControlProps {
  equipment: BETRecord;
  onStatusChange?: () => void;
}

export default function ChargingControl({ equipment, onStatusChange }: ChargingControlProps) {
  const { profile } = useAuth();
  const [currentLog, setCurrentLog] = useState<ChargingLog | null>(null);
  const [logs, setLogs] = useState<ChargingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch current active log and history on mount
  useEffect(() => {
    fetchCurrentLog();
    fetchLogs();
    
    // Subscribe to changes
    const channel = supabase
      .channel('charging_logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'charging_logs',
          filter: `equipment_id=eq.${equipment.id}`,
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
  }, [equipment.id]);

  const fetchCurrentLog = async () => {
    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', equipment.id)
        .is('end_time', null)
        .maybeSingle();

      if (error) throw error;
      setCurrentLog(data);
    } catch (error) {
      console.error('Error fetching current log:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('charging_logs')
        .select('*')
        .eq('equipment_id', equipment.id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const startCharging = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('charging_logs')
        .insert([{
          equipment_id: equipment.id,
          user_id: profile.id,
          location_id: equipment.location_id,
          start_time: new Date().toISOString(),
        }]);

      if (error) throw error;
      if (onStatusChange) onStatusChange();
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
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setError(err.message || 'Failed to stop charging');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{equipment.equipment_id}</h3>
          <p className="text-sm text-gray-500">{equipment.equipment_type}</p>
        </div>
        {profile?.role === 'user' && (
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
        )}
      </div>

      {profile?.role !== 'user' && currentLog && (
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <BatteryCharging className="w-4 h-4" />
          Currently being charged by another user
        </div>
      )}

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
                  {profile?.role !== 'user' && (
                    <div className="pt-1 border-t border-gray-100">
                      Recorded by: {log.user_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}