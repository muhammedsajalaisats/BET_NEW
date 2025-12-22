import { useState, useEffect } from 'react';
import { supabase, Location } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, MapPin, Clock, Download, Zap } from 'lucide-react';

// Extended ChargingLog type with all fields
interface ExtendedChargingLog {
  id: string;
  user_id: string;
  equipment_id: string;
  location_id: string;
  charging_point_id: string | null;
  start_time: string;
  end_time: string | null;
  Meter_reading: string | null;
  stopped_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ChargingLogWithRelations extends ExtendedChargingLog {
  user_profile: { full_name: string; } | null;
  equipment: { equipment_id: string; equipment_type: string; } | null;
  stopped_by_profile: { full_name: string; } | null;
}

interface ChargingRecordsTableProps {
  locations: Location[];
}

export default function ChargingRecordsTable({ locations }: ChargingRecordsTableProps) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ChargingLogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeChargingCount, setActiveChargingCount] = useState(0);

  useEffect(() => {
    fetchChargingLogs();
    fetchActiveChargingCount();
  }, [selectedLocation, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchActiveChargingCount();
  }, [selectedLocation, profile]);

  const fetchChargingLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('charging_logs')
        .select(`
          *,
          user_profile:user_profiles!charging_logs_user_id_fkey(full_name),
          equipment:bet_records(equipment_id, equipment_type),
          stopped_by_profile:user_profiles!charging_logs_stopped_by_fkey(full_name)
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

      // Apply date filters based on created_at
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching charging logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChargingCount = async () => {
    try {
      let query = supabase
        .from('charging_logs')
        .select('id', { count: 'exact', head: true })
        .is('end_time', null);

      // Apply location filter
      if (profile?.role === 'admin') {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { count, error } = await query;

      if (error) throw error;
      setActiveChargingCount(count || 0);
    } catch (error) {
      console.error('Error fetching active charging count:', error);
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
      log.user_profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.charging_point_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.stopped_by_profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const downloadCSV = async () => {
    setDownloading(true);
    try {
      // Fetch data for download (same filters as display)
      let query = supabase
        .from('charging_logs')
        .select(`
          *,
          user_profile:user_profiles!charging_logs_user_id_fkey(full_name),
          equipment:bet_records(equipment_id, equipment_type),
          stopped_by_profile:user_profiles!charging_logs_stopped_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      // Apply same filters
      if (profile?.role === 'admin') {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      if (statusFilter === 'active') {
        query = query.is('end_time', null);
      } else if (statusFilter === 'completed') {
        query = query.not('end_time', 'is', null);
      }

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No data to download');
        return;
      }

      // Create CSV content
      const headers = [
        'Log ID',
        'Equipment ID',
        'Equipment Type',
        'User Name',
        'Location',
        'Charging Point ID',
        'Start Time',
        'End Time',
        'Duration (minutes)',
        'Meter Reading',
        'Stopped By',
        'Status',
        'Created At'
      ];

      const csvRows = [headers.join(',')];

      data.forEach((log: ChargingLogWithRelations) => {
        const duration = log.end_time 
          ? Math.floor((new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / (1000 * 60))
          : Math.floor((new Date().getTime() - new Date(log.start_time).getTime()) / (1000 * 60));

        const row = [
          log.id,
          log.equipment?.equipment_id || '',
          log.equipment?.equipment_type || '',
          log.user_profile?.full_name || '',
          getLocationName(log.location_id),
          log.charging_point_id || '',
          new Date(log.start_time).toLocaleString(),
          log.end_time ? new Date(log.end_time).toLocaleString() : 'Active',
          duration.toString(),
          log.Meter_reading?.toString() || '',
          log.stopped_by_profile?.full_name || '',
          log.end_time ? 'Completed' : 'Active',
          new Date(log.created_at).toLocaleString()
        ];

        // Escape fields that might contain commas
        const escapedRow = row.map(field => {
          const fieldStr = String(field);
          if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }
          return fieldStr;
        });

        csvRows.push(escapedRow.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Generate filename with date range
      const locationStr = selectedLocation === 'all' ? 'all-locations' : getLocationName(selectedLocation).replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dateStr = startDate && endDate 
        ? `${startDate}_to_${endDate}`
        : startDate 
        ? `from_${startDate}`
        : endDate
        ? `until_${endDate}`
        : 'all-dates';
      
      link.href = url;
      link.download = `charging-logs_${locationStr}_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download data');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Charging Records</h2>
          <p className="text-sm text-gray-500 mt-1">View and monitor equipment charging activities</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
          <button
            onClick={downloadCSV}
            disabled={downloading || loading || filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Downloading...' : 'Download CSV'}
          </button>
        )}
      </div>

      {/* Active Charging Card */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">Active Charging</h3>
            </div>
            <p className="text-4xl font-bold">{activeChargingCount}</p>
            <p className="text-sm opacity-90 mt-1">
              {activeChargingCount === 1 ? 'equipment currently charging' : 'equipment currently charging'}
            </p>
          </div>
          <div className="bg-white/20 p-4 rounded-lg backdrop-blur-sm">
            <Zap className="w-12 h-12" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by equipment ID, type, user, or charging point..."
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

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {(startDate || endDate) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear Dates
                </button>
              </div>
            )}
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Charging Point</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Start Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">End Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Meter Reading</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stopped By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600">{log.id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.equipment?.equipment_id || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{log.equipment?.equipment_type || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{log.user_profile?.full_name || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{getLocationName(log.location_id)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{log.charging_point_id || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(log.start_time).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {log.end_time ? new Date(log.end_time).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDuration(log.start_time, log.end_time)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {log.Meter_reading !== null && log.Meter_reading !== undefined ? log.Meter_reading : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {log.stopped_by_profile?.full_name || '-'}
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