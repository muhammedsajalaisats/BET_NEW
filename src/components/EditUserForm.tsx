import { useState } from 'react';
import { X, Mail, Zap, Battery } from 'lucide-react';
import { supabase, Location, UserProfile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EditUserFormProps {
  user: UserProfile;
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserForm({ user, locations, onClose, onSuccess }: EditUserFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    location_id: user.location_id || '',
    is_active: user.is_active,
    Charging_Access: user.Charging_Access !== undefined ? user.Charging_Access : true,
    Swapping_Access: user.Swapping_Access !== undefined ? user.Swapping_Access : false,
    password: '', // Optional password change
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create admin client function
 const createAdminClient = async () => {
  // Dynamically import supabase-js to avoid window.supabase issue
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Enforce editing rules
      if (profile?.role === 'admin') {
        // Admins can only edit users in their location
        if (user.role !== 'user' || user.location_id !== profile.location_id) {
          throw new Error('You do not have permission to edit this user.');
        }
        // Admins cannot change user roles or locations
        formData.role = 'user';
        formData.location_id = profile.location_id || '';
      }

      const updates: any = {
        full_name: formData.full_name,
        is_active: formData.is_active,
        Charging_Access: formData.Charging_Access,
        Swapping_Access: formData.Swapping_Access,
        updated_at: new Date().toISOString(),
      };

      // Only super_admin can change roles and locations
      if (profile?.role === 'super_admin') {
        updates.role = formData.role;
        updates.location_id = formData.role === 'super_admin' ? null : formData.location_id;
      }

      // Update user profile
      const { data: updateData, error: profileError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(profileError.message || 'Failed to update user profile');
      }

      // Update password if provided - Using service role key directly
    if (formData.password && formData.password.length >= 6) {
  const supabaseAdmin = await createAdminClient();
  const { data: passwordData, error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: formData.password }
  );

  if (passwordError) {
    console.error('Password update error:', passwordError);
    throw new Error(passwordError.message || 'Failed to update password');
  }
}

      onSuccess();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{formData.email}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Leave blank to keep current password"
              minLength={6}
            />
            <p className="mt-1 text-sm text-gray-500">
              Minimum 6 characters
            </p>
          </div>

          {profile?.role === 'super_admin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {formData.role !== 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location *
                  </label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Location</option>
                    {locations.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                <span className="ms-3 text-sm font-medium text-gray-700">Active Account</span>
              </label>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-sm font-medium text-gray-700 mb-3">Function Access</p>
              
              <div className="flex items-center gap-3 mb-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.Charging_Access}
                    onChange={(e) => setFormData({ ...formData, Charging_Access: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Charging Access</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.Swapping_Access}
                    onChange={(e) => setFormData({ ...formData, Swapping_Access: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Swapping Access</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}