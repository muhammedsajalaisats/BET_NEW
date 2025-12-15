import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Battery } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChargingPoint {
  id: string;
  Charging_Points_Name: string;
  Locations: string;
  created_at?: string;
  updated_at?: string;
}

interface ChargingPointsProps {
  locations: any[];
}

export default function ChargingPoints({ locations }: ChargingPointsProps) {
  const { profile } = useAuth();
  const [chargingPoints, setChargingPoints] = useState<ChargingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    Charging_Points_Name: '',
    Locations: ''
  });

  useEffect(() => {
    if ((profile?.role === 'admin' || profile?.role === 'super_admin') && profile?.location_id) {
      fetchChargingPoints();
    }
  }, [profile]);

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location ? `${location.code} - ${location.name}` : 'Unknown';
  };

  const fetchChargingPoints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Charging_Points')
        .select('*')
        .eq('Locations', profile?.location_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChargingPoints(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch charging points');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      Charging_Points_Name: '',
      Locations: profile?.location_id || ''
    });
    setEditingId(null);
  };

  const handleEdit = (point: ChargingPoint) => {
    setEditingId(point.id);
    setFormData({
      Charging_Points_Name: point.Charging_Points_Name,
      Locations: point.Locations
    });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      Charging_Points_Name: '',
      Locations: ''
    });
    setError('');
  };

  const handleSave = async () => {
    if (!formData.Charging_Points_Name.trim()) {
      setError('Charging point name is required');
      return;
    }

    if (!profile?.location_id) {
      setError('Admin location not found');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('Charging_Points')
          .insert([{
            Charging_Points_Name: formData.Charging_Points_Name.trim(),
            Locations: profile.location_id
          }]);

        if (error) throw error;
        setSuccess('Charging point added successfully');
      } else if (editingId) {
        const { error } = await supabase
          .from('Charging_Points')
          .update({
            Charging_Points_Name: formData.Charging_Points_Name.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .eq('Locations', profile.location_id);

        if (error) throw error;
        setSuccess('Charging point updated successfully');
      }

      handleCancel();
      fetchChargingPoints();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save charging point');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this charging point?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('Charging_Points')
        .delete()
        .eq('id', id)
        .eq('Locations', profile?.location_id);

      if (error) throw error;
      setSuccess('Charging point deleted successfully');
      fetchChargingPoints();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete charging point');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Manage Charging Points</h3>
          <p className="text-sm text-gray-500">
            Location: {profile?.location_id ? getLocationName(profile.location_id) : 'N/A'}
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Charging Point
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {(isAdding || editingId) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">
            {isAdding ? 'Add New Charging Point' : 'Edit Charging Point'}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Charging Point Name *
              </label>
              <input
                type="text"
                value={formData.Charging_Points_Name}
                onChange={(e) => setFormData({ ...formData, Charging_Points_Name: e.target.value })}
                placeholder="Enter charging point name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={profile?.location_id ? getLocationName(profile.location_id) : ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Location is set to your admin location</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && chargingPoints.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : chargingPoints.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No charging points found. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chargingPoints.map(point => (
            <div
              key={point.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{point.Charging_Points_Name}</h4>
                  <p className="text-sm text-gray-500 mt-1">Location: {getLocationName(point.Locations)}</p>
                  {point.created_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Added: {new Date(point.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(point)}
                    disabled={loading || isAdding || editingId !== null}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {profile?.role === 'super_admin' && (
                    <button
                      onClick={() => handleDelete(point.id)}
                      disabled={loading || isAdding || editingId !== null}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}