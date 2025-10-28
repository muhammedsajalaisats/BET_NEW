import { useState, useEffect } from 'react';
import { supabase, ChargingLog, Location } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, MapPin, Clock } from 'lucide-react';

interface ChargingRecordsTableProps {
  locations: Location[];
}

export default function ChargingRecordsTable({ locations }: ChargingRecordsTableProps) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<(ChargingLog & { 
    user_profile: { full_name: string; }, 
    equipment: { equipment_id: string; equipment_type: string; }
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('all');

  useEffect(() => {
    fetchChargingLogs();
  }, [selectedLocation, statusFilter]);

  const fetchChargingLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('charging_logs')
        .select(`
          *,
          user_profile:user_profiles(full_name),
          equipment:bet_records(equipment_id, equipment_type)
        `)
        .order('start_time', { ascending: false });

      // Apply location filter
      if (profile?.role === 'admin') {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.is('end_time', null);
      } else if (statusFilter === 'completed') {
        query = query.not('end_time', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching charging logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location ? `${location.code} - ${location.name}` : 'Unknown';
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) {
      const duration = new Date().getTime() - new Date(startTime).getTime();
      const minutes = Math.floor(duration / (1000 * 60));
      return `${minutes} mins (Active)`;
    }
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    return `${minutes} mins`;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.equipment?.equipment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.equipment?.equipment_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Charging Records</h2>
        <p className="text-sm text-gray-500 mt-1">View and monitor equipment charging activities</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by equipment ID, type, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {profile?.role === 'super_admin' && (
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
              >
                <option value="all">All Locations</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'completed' | 'all')}
              className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-3">Loading records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No charging records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Log ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Equipment</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Start Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">End Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600">{log.id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.equipment?.equipment_id}</p>
                        <p className="text-xs text-gray-500">{log.equipment?.equipment_type}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{log.user_profile?.full_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{getLocationName(log.location_id)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(log.start_time).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {log.end_time ? new Date(log.end_time).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDuration(log.start_time, log.end_time)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.end_time 
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {log.end_time ? 'Completed' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}