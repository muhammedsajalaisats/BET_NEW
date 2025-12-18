import { useState, useEffect } from 'react';
import { Search, MapPin, Download, RefreshCw } from 'lucide-react';
import { supabase, Location, UserProfile, BETRecord } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SwappingControlProps {
  locations: Location[];
}

// Extended SwappingLog type with all fields
interface ExtendedSwappingLog {
  id: number;
  User_id: string;
  equipment_id: string;
  location_id: string;
  Count: string | number;
  Meter_reading: number | null;
  Battery_Number: string | null;
  created_at: string;
  updated_at: string;
}

interface SwappingLogWithJoins extends ExtendedSwappingLog {
  user_profiles?: UserProfile;
  bet_records?: BETRecord;
  locations?: Location;
}

export default function SwappingControl({ locations }: SwappingControlProps) {
  const { profile } = useAuth();
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
  }, [selectedLocation, startDate, endDate, profile]);

  const fetchSwappingLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build base query
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profiles:user_profiles(*),
          bet_records:bet_records(*),
          locations:locations(*)
        `)
        .order('created_at', { ascending: false });

      // Apply location filter based on role
      if (profile?.role === 'admin') {
        if (profile.location_id) {
          query = query.eq('location_id', profile.location_id);
        }
      } else if (profile?.role === 'super_admin') {
        if (selectedLocation !== 'all') {
          query = query.eq('location_id', selectedLocation);
        }
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
        console.error('Supabase error:', error);
        throw error;
      }

      const fetchedLogs = data || [];
      setLogs(fetchedLogs);

      // Calculate total swaps
      const total = fetchedLogs.reduce((sum, log: any) => {
        const count = parseInt(log.Count || '0', 10);
        return sum + (isNaN(count) ? 0 : count);
      }, 0);
      setTotalSwaps(total);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Failed to fetch swapping logs');
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (log: SwappingLogWithJoins) => {
    if (log.locations) {
      return `${log.locations.code} - ${log.locations.name}`;
    }
    const loc = locations.find(l => l.id === log.location_id);
    return loc ? `${loc.code} - ${loc.name}` : 'Unknown';
  };

  const getEquipmentInfo = (log: SwappingLogWithJoins) => {
    if (log.bet_records) {
      return {
        equipment_id: log.bet_records.equipment_id || 'N/A',
        equipment_type: log.bet_records.equipment_type || 'N/A',
      };
    }
    return { equipment_id: log.equipment_id || 'N/A', equipment_type: 'N/A' };
  };

  const getUserInfo = (log: SwappingLogWithJoins) => {
    if (log.user_profiles) {
      return {
        name: log.user_profiles.full_name || 'Unknown',
        email: log.user_profiles.email || 'N/A',
      };
    }
    return { name: `User (${log.User_id?.slice(0, 6)}...)`, email: 'N/A' };
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const eq = getEquipmentInfo(log);
    const user = getUserInfo(log);
    return (
      eq.equipment_id.toLowerCase().includes(search) ||
      eq.equipment_type.toLowerCase().includes(search) ||
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      getLocationName(log).toLowerCase().includes(search) ||
      (log.Count && log.Count.toString().includes(search)) ||
      (log.Battery_Number && log.Battery_Number.toLowerCase().includes(search)) ||
      (log.Meter_reading && log.Meter_reading.toString().includes(search)) ||
      log.id.toString().includes(search)
    );
  });

  const downloadCSV = async () => {
    setDownloading(true);

    try {
      let query = supabase
        .from('swapping_log')
        .select(`
          *,
          user_profiles:user_profiles(*),
          bet_records:bet_records(*),
          locations:locations(*)
        `)
        .order('created_at', { ascending: false });

      // Apply same location filter as display
      if (profile?.role === 'admin' && profile.location_id) {
        query = query.eq('location_id', profile.location_id);
      } else if (profile?.role === 'super_admin' && selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      // Apply same date filters
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

      // Create CSV headers
      const headers = [
        'Log ID',
        'Equipment ID',
        'Equipment Type',
        'User Name',
        'User Email',
        'Location',
        'Swap Count',
        'Meter Reading',
        'Battery Number',
        'Created Date',
        'Created Time',
      ];

      const csvRows = [headers.join(',')];

      // Add data rows
      data.forEach((log: any) => {
        const eq = getEquipmentInfo(log);
        const user = getUserInfo(log);
        const loc = getLocationName(log);
        const d = new Date(log.created_at);
        
        const row = [
          log.id,
          eq.equipment_id,
          eq.equipment_type,
          user.name,
          user.email,
          loc,
          log.Count || '0',
          log.Meter_reading !== null && log.Meter_reading !== undefined ? log.Meter_reading.toString() : '',
          log.Battery_Number || '',
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
        ];

        // Escape fields that might contain commas
        const escapedRow = row.map((field) => {
          const fieldStr = String(field);
          if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }
          return fieldStr;
        });

        csvRows.push(escapedRow.join(','));
      });

      // Create and download CSV file
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      // Generate filename
      let locCode = 'all-locations';
      if (profile?.role === 'admin' && profile.location_id) {
        const adminLoc = locations.find(l => l.id === profile.location_id);
        locCode = adminLoc?.code || 'location';
      } else if (selectedLocation !== 'all') {
        const selectedLoc = locations.find(l => l.id === selectedLocation);
        locCode = selectedLoc?.code || 'location';
      }

      const dateRange =
        startDate && endDate
          ? `${startDate}_to_${endDate}`
          : startDate
          ? `from_${startDate}`
          : endDate
          ? `until_${endDate}`
          : 'all-dates';

      link.href = url;
      link.download = `swapping-logs_${locCode}_${dateRange}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('CSV download failed:', err);
      alert('Failed to download CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    fetchSwappingLogs();
  };

  const clearAllFilters = () => {
    if (profile?.role === 'super_admin') {
      setSelectedLocation('all');
    }
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = 
    (profile?.role === 'super_admin' && selectedLocation !== 'all') || 
    searchTerm || 
    startDate || 
    endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Swapping Records</h2>
          <p className="text-sm text-gray-500 mt-1">
            View and monitor equipment swapping activities
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

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
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Total swaps card */}
      {!error && (
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5" />
                <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">
                  Total Swaps
                </h3>
              </div>
              <p className="text-4xl font-bold">{totalSwaps}</p>
              <p className="text-sm opacity-90 mt-1">
                {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'}
              </p>
            </div>
            <div className="bg-white/20 p-4 rounded-lg backdrop-blur-sm">
              <RefreshCw className="w-12 h-12" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Table */}
      {!error && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by equipment, user, location, battery number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Location dropdown - only for super_admin */}
              {profile?.role === 'super_admin' && (
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                  >
                    <option value="all">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
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
                  End Date
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

          {/* Table */}
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Log ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Equipment
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      User
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Location
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Swap Count
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Meter Reading
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Battery Number
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Date & Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const eq = getEquipmentInfo(log);
                    const user = getUserInfo(log);
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-gray-600">#{log.id}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {eq.equipment_id}
                            </p>
                            <p className="text-xs text-gray-500">{eq.equipment_type}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{user.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {getLocationName(log)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                            {log.Count || '0'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {log.Meter_reading !== null && log.Meter_reading !== undefined ? log.Meter_reading : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {log.Battery_Number || '-'}
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
      )}
    </div>
  );
}