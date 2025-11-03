import { useState, useEffect } from 'react';
import { Search, MapPin, Download, RefreshCw } from 'lucide-react';
import { supabase, SwappingLog, Location, UserProfile, BETRecord } from '../lib/supabase';

interface Profile {
  role: 'super_admin' | 'admin' | 'user';
  location_id?: string;
}

interface SwappingControlProps {
  locations: Location[];
  profile: Profile | null;
}

// Extended interface for joined data
interface SwappingLogWithJoins extends SwappingLog {
  user_profiles?: UserProfile;
  bet_records?: BETRecord;
  locations?: Location;
}

export default function SwappingControl({ locations, profile }: SwappingControlProps) {
  const [logs, setLogs] = useState<SwappingLogWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalSwaps, setTotalSwaps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSwappingLogs();
  }, [selectedLocation, startDate, endDate]);

  const fetchSwappingLogs = async () => {
    if (!supabase) {
      setError('Database connection not available. Please check if Supabase client is properly initialized.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('Starting to fetch swapping logs with joins...');

      // Query with joins to get equipment_id and user email
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profiles!swapping_log_User_id_fkey(*),
          bet_records!swapping_log_equipment_id_fkey(*),
          locations!swapping_log_location_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      // Apply location filter
      if (profile?.role === 'admin' && profile.location_id) {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all' && profile?.role === 'super_admin') {
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

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      console.log('Fetched data with joins:', data);
      setLogs(data || []);
      
      // Calculate total swaps
      const total = (data || []).reduce((sum: number, log: SwappingLogWithJoins) => {
        const count = parseInt(log.Count || '0');
        return sum + (isNaN(count) ? 0 : count);
      }, 0);
      setTotalSwaps(total);

    } catch (error: any) {
      console.error('Error fetching swapping logs:', error);
      setError(error.message || 'Failed to fetch swapping logs');
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (log: SwappingLogWithJoins) => {
    if (log.locations) {
      return `${log.locations.code} - ${log.locations.name}`;
    }
    const location = locations.find(l => l.id === log.location_id);
    return location ? `${location.code} - ${location.name}` : `Location (${log.location_id?.slice(0, 8)}...)`;
  };

  const getEquipmentInfo = (log: SwappingLogWithJoins) => {
    if (log.bet_records) {
      return {
        equipment_id: log.bet_records.equipment_id,
        equipment_type: log.bet_records.equipment_type
      };
    }
    return {
      equipment_id: log.equipment_id ? `Equipment (${log.equipment_id.slice(0, 8)}...)` : 'N/A',
      equipment_type: 'N/A'
    };
  };

  const getUserInfo = (log: SwappingLogWithJoins) => {
    if (log.user_profiles) {
      return {
        name: log.user_profiles.full_name,
        email: log.user_profiles.email
      };
    }
    return {
      name: `User (${log.User_id?.slice(0, 8)}...)`,
      email: 'N/A'
    };
  };

  const filteredLogs = logs.filter((log: SwappingLogWithJoins) => {
    if (!searchTerm) return true;
    
    const equipment = getEquipmentInfo(log);
    const user = getUserInfo(log);
    const searchLower = searchTerm.toLowerCase();
    
    return (
      equipment.equipment_id?.toLowerCase().includes(searchLower) ||
      equipment.equipment_type?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      log.Count?.includes(searchTerm) ||
      getLocationName(log).toLowerCase().includes(searchLower) ||
      log.id.toString().includes(searchTerm)
    );
  });

  const downloadCSV = async () => {
    if (!supabase) {
      alert('Database connection not available');
      return;
    }

    setDownloading(true);
    try {
      console.log('Starting CSV download...');
      console.log('Filters - Start Date:', startDate, 'End Date:', endDate, 'Location:', selectedLocation);

      // Build query with same filters as display
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profiles!swapping_log_User_id_fkey(*),
          bet_records!swapping_log_equipment_id_fkey(*),
          locations!swapping_log_location_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      // Apply location filter
      if (profile?.role === 'admin' && profile.location_id) {
        query = query.eq('location_id', profile.location_id);
      } else if (selectedLocation !== 'all' && profile?.role === 'super_admin') {
        query = query.eq('location_id', selectedLocation);
      }

      // Apply date filters based on created_at
      if (startDate) {
        const startDateTime = `${startDate}T00:00:00`;
        console.log('Applying start date filter:', startDateTime);
        query = query.gte('created_at', startDateTime);
      }
      if (endDate) {
        const endDateTime = `${endDate}T23:59:59`;
        console.log('Applying end date filter:', endDateTime);
        query = query.lte('created_at', endDateTime);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Download query error:', error);
        throw error;
      }

      console.log('Downloaded data count:', data?.length || 0);

      if (!data || data.length === 0) {
        alert('No data to download for the selected filters');
        return;
      }

      // Create CSV content
      const headers = [
        'Log ID',
        'Equipment ID',
        'Equipment Type',
        'User Name',
        'User Email',
        'Location',
        'Swap Count',
        'Created Date',
        'Created Time'
      ];

      const csvRows = [headers.join(',')];

      data.forEach((log: SwappingLogWithJoins) => {
        const equipment = getEquipmentInfo(log);
        const user = getUserInfo(log);
        const createdDate = new Date(log.created_at);
        
        const row = [
          log.id,
          equipment.equipment_id,
          equipment.equipment_type,
          user.name,
          user.email,
          getLocationName(log),
          log.Count || '0',
          createdDate.toLocaleDateString(),
          createdDate.toLocaleTimeString()
        ];

        // Escape fields that might contain commas or quotes
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
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      link.href = url;
      link.download = `swapping-logs_${locationStr}_${dateStr}_${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('CSV download completed successfully');
      alert(`Successfully downloaded ${data.length} records`);
      
    } catch (error: any) {
      console.error('Error downloading CSV:', error);
      alert(`Failed to download data: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    fetchSwappingLogs();
  };

  const clearAllFilters = () => {
    setSelectedLocation('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Records Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Swapping Records</h2>
          <p className="text-sm text-gray-500 mt-1">View and monitor equipment swapping activities</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
            <button
              onClick={downloadCSV}
              disabled={downloading || loading || logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title={logs.length === 0 ? 'No data available to download' : 'Download swapping records as CSV'}
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Connection Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900">Connection Issue</h3>
          <p className="text-red-700 mt-2">{error}</p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-red-600">Possible solutions:</p>
            <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
              <li>Check if Supabase client is properly initialized</li>
              <li>Verify your Supabase URL and API key</li>
              <li>Check your internet connection</li>
              <li>Ensure the swapping_log table exists in your database</li>
            </ul>
          </div>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Only show content if no connection error */}
      {!error && (
        <>
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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                {(selectedLocation !== 'all' || searchTerm || startDate || endDate) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by equipment ID, type, user, email, count, location, or log ID..."
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date (Created At)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (Created At)
                  </label>
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
                <div className="text-gray-500 mb-4">
                  {logs.length === 0 ? 'No swapping records found in the database' : 'No records match your search criteria'}
                </div>
                {logs.length === 0 ? (
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                ) : (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Log ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Equipment</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Swap Count</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const equipment = getEquipmentInfo(log);
                      const user = getUserInfo(log);
                      return (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-600">#{log.id}</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{equipment.equipment_id}</p>
                              <p className="text-xs text-gray-500">{equipment.equipment_type}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">{user.name}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}