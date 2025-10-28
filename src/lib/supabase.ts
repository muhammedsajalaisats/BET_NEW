import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  role: 'super_admin' | 'admin' | 'user';
  location_id: string | null;
  is_active: boolean;
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
}
