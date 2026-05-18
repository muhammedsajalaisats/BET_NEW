import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client using the service role key.
// Use ONLY for privileged server-side operations (e.g. creating users).
// It bypasses RLS and never touches the browser auth session.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface Location {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin' | 'super_admin';
  location_id: string | null;
  is_active: boolean;
  Charging_Access: boolean;  // Use capital letters to match DB
  Swapping_Access: boolean;  // Use capital letters to match DB
  created_at: string;
  updated_at: string;
}

export interface BETRecord {
  id: string;
  location_id: string;
  equipment_id: string;
  equipment_type: string;
  status: 'operational' | 'maintenance' | 'faulty';
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  notes: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChargingLog {
  id: string;
  equipment_id: string;
  user_id: string;
  location_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  Meter_reading?: string | null;  // Changed from number | null to string | null
  charging_point_id?: string | null;
}

export interface SwappingLog {
  id: number;
  created_at: string;
  User_id: string;
  location_id: string;
  equipment_id: string;
  Count: string;
  user_profiles?: UserProfile;
  bet_records?: BETRecord;
  locations?: Location;
}