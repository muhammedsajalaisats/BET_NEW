import { useState, useEffect } from 'react';
import { Search, MapPin, Download, RefreshCw } from 'lucide-react';

// Type definitions based on your schema
interface SwappingLog {
  id: number;
  created_at: string;
  User_id: string;
  location_id: string;
  equipment_id: string;
  Count: string;
  user_profile?: { full_name: string };
  equipment?: { equipment_id: string; equipment_type: string };
  location?: { code: string; name: string };
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Profile {
  role: 'super_admin' | 'admin' | 'user';
  location_id?: string;
}

interface SwappingControlProps {
  locations: Location[];
  supabase: any;
  profile: Profile | null;
}

export default function SwappingControl({ locations, supabase, profile }: SwappingControlProps) {
  const [logs, setLogs] = useState<SwappingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalSwaps, setTotalSwaps] = useState(0);

  useEffect(() => {
    fetchSwappingLogs();
  }, [selectedLocation, startDate, endDate]);

  const fetchSwappingLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profile:user_profiles!swapping_log_User_id_fkey(full_name),
          equipment:bet_records!swapping_log_equipment_id_fkey(equipment_id, equipment_type),
          location:locations!swapping_log_location_id_fkey(code, name)
        `)
        .order('created_at', { ascending: false });

      // Apply location filter
      if (profile?.role === 'admin') {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      // Apply date filters
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
      
      // Calculate total swaps
      const total = (data || []).reduce((sum: number, log: SwappingLog) => sum + parseInt(log.Count || '0'), 0);
      setTotalSwaps(total);
    } catch (error) {
      console.error('Error fetching swapping logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (log: SwappingLog) => {
    if (log.location) {
      return `${log.location.code} - ${log.location.name}`;
    }
    const location = locations.find(l => l.id === log.location_id);
    return location ? `${location.code} - ${location.name}` : 'Unknown';
  };

  const filteredLogs = logs.filter((log: SwappingLog) => {
    const matchesSearch = 
      log.equipment?.equipment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.equipment?.equipment_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.Count?.includes(searchTerm);
    return matchesSearch;
  });

  const downloadCSV = async () => {
    setDownloading(true);
    try {
      // Fetch data for download (same filters as display)
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profile:user_profiles!swapping_log_User_id_fkey(full_name),
          equipment:bet_records!swapping_log_equipment_id_fkey(equipment_id, equipment_type),
          location:locations!swapping_log_location_id_fkey(code, name)
        `)
        .order('created_at', { ascending: false });

      // Apply same filters
      if (profile?.role === 'admin') {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
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
        'Swap Count',
        'Date & Time'
      ];

      const csvRows = [headers.join(',')];

      data.forEach((log: SwappingLog) => {
        const row = [
          log.id,
          log.equipment?.equipment_id || '',
          log.equipment?.equipment_type || '',
          log.user_profile?.full_name || '',
          log.location ? `${log.location.code} - ${log.location.name}` : 'Unknown',
          log.Count || '0',
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
      const locationStr = selectedLocation === 'all' 
        ? 'all-locations' 
        : locations.find(l => l.id === selectedLocation)?.code.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'location';
      const dateStr = startDate && endDate 
        ? `${startDate}_to_${endDate}`
        : startDate 
        ? `from_${startDate}`
        : endDate
        ? `until_${endDate}`
        : 'all-dates';
      
      link.href = url;
      link.download = `swapping-logs_${locationStr}_${dateStr}.csv`;
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
      {/* Records Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Swapping Records</h2>
          <p className="text-sm text-gray-500 mt-1">View and monitor equipment swapping activities</p>
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

      {/* Total Swaps Card */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5" />
              <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">Total Swaps</h3>
            </div>
            <p className="text-4xl font-bold">{totalSwaps}</p>
            <p className="text-sm opacity-90 mt-1">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'} found
            </p>
          </div>
          <div className="bg-white/20 p-4 rounded-lg backdrop-blur-sm">
            <RefreshCw className="w-12 h-12" />
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by equipment ID, type, user, or count..."
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
            <p className="text-gray-500">No swapping records found</p>
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Swap Count</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600">#{log.id}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.equipment?.equipment_id || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{log.equipment?.equipment_type || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{log.user_profile?.full_name || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{getLocationName(log)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                        {log.Count || '0'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
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