import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Location, BETRecord } from '../lib/supabase';
import { Plus, Search, Filter, Plane, MapPin, AlertCircle, CheckCircle, Wrench, LogOut, Battery } from 'lucide-react';
import BETRecordForm from './BETRecordForm';
import UserManagement from './UserManagement';
import ChargingRecordsTable from './ChargingRecordsTable';
import SwappingControl from './SwappingControl';
import ChargingPoints from './ChargingPoints';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [betRecords, setBetRecords] = useState<BETRecord[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BETRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'users' | 'charging' | 'swapping' | 'charging-points'>('records');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations();
    fetchBETRecords();
  }, [selectedLocation]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchBETRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bet_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (profile?.role === 'admin' && profile.location_id) {
        query = query.eq('location_id', profile.location_id);
      } else if (profile?.role === 'super_admin' && selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBetRecords(data || []);
    } catch (error) {
      console.error('Error fetching BET records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const { error } = await supabase
        .from('bet_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchBETRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    }
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location ? `${location.code} - ${location.name}` : 'Unknown';
  };

  const filteredRecords = betRecords.filter(record => {
    const matchesSearch =
      record.equipment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.equipment_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    operational: betRecords.filter(r => r.status === 'operational').length,
    maintenance: betRecords.filter(r => r.status === 'maintenance').length,
    faulty: betRecords.filter(r => r.status === 'faulty').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-100 text-green-800 border-green-200';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'faulty': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="w-4 h-4" />;
      case 'maintenance': return <Wrench className="w-4 h-4" />;
      case 'faulty': return <AlertCircle className="w-4 h-4" />;
      default: return null;
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
                <h1 className="text-xl font-bold text-gray-900">EV Charging Tracker</h1>
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
        {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
          <div className="mb-6">
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'records'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Vehicle Records
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {profile?.role === 'admin' ? 'Create User' : 'User Management'}
              </button>
              <button
                onClick={() => setActiveTab('charging')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'charging'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Charging Control
              </button>
              <button
                onClick={() => setActiveTab('swapping')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'swapping'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Swapping Control
              </button>
              <button
                onClick={() => setActiveTab('charging-points')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'charging-points'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Battery className="w-4 h-4 mr-1 inline" />
                Charging Points
              </button>
            </div>
          </div>
        )}

        {activeTab === 'users' ? (
          <UserManagement locations={locations} />
        ) : activeTab === 'charging' ? (
          <ChargingRecordsTable locations={locations} />
        ) : activeTab === 'swapping' ? (
          <SwappingControl locations={locations} />
        ) : activeTab === 'charging-points' ? (
          <ChargingPoints locations={locations} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Operational</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{statusCounts.operational}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-yellow-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Maintenance</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">{statusCounts.maintenance}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Wrench className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Faulty</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{statusCounts.faulty}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by equipment ID or type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {profile?.role === 'super_admin' ? (
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
                ) : profile?.role === 'admin' && profile.location_id && (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <div className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                      {getLocationName(profile.location_id)}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="operational">Operational</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="faulty">Faulty</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setShowAddForm(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:from-sky-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Record
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-600 mt-3">Loading records...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Equipment ID</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Inspection</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Next Inspection</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{record.equipment_id}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{record.equipment_type}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{getLocationName(record.location_id)}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              {record.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {record.last_inspection_date ? new Date(record.last_inspection_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {record.next_inspection_date ? new Date(record.next_inspection_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingRecord(record);
                                  setShowAddForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Edit
                              </button>
                              {profile?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showAddForm && (
        <BETRecordForm
          record={editingRecord}
          locations={locations}
          onClose={() => {
            setShowAddForm(false);
            setEditingRecord(null);
          }}
          onSuccess={() => {
            setShowAddForm(false);
            setEditingRecord(null);
            fetchBETRecords();
          }}
        />
      )}
    </div>
  );
}