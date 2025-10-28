/*
  # BET Tracker Schema for Air India Sats

  ## Overview
  Complete database schema for multi-location BET (Belt Equipment Tracking) management system
  with role-based access control for Super Admin, Admin, and User roles.

  ## 1. New Tables

  ### `locations`
  - `id` (uuid, primary key) - Unique identifier for each location
  - `code` (text, unique) - Airport code (DEL, TRV, HYD, BLR, IXE)
  - `name` (text) - Full location name
  - `is_active` (boolean) - Whether location is currently active
  - `created_at` (timestamptz) - Creation timestamp

  ### `user_profiles`
  - `id` (uuid, primary key, references auth.users) - Links to Supabase auth user
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'super_admin', 'admin', or 'user'
  - `location_id` (uuid, references locations) - Assigned location (null for super_admin)
  - `is_active` (boolean) - Account status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `bet_records`
  - `id` (uuid, primary key) - Unique record identifier
  - `location_id` (uuid, references locations) - Associated location
  - `equipment_id` (text) - Equipment identification number
  - `equipment_type` (text) - Type of belt equipment
  - `status` (text) - Current status: 'operational', 'maintenance', 'faulty'
  - `last_inspection_date` (date) - Date of last inspection
  - `next_inspection_date` (date) - Scheduled next inspection
  - `notes` (text) - Additional notes or comments
  - `created_by` (uuid, references user_profiles) - User who created the record
  - `updated_by` (uuid, references user_profiles) - User who last updated
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security (Row Level Security)

  ### Locations Table
  - Enable RLS
  - Super Admin: full access to all locations
  - Admin/User: read access to their assigned location only

  ### User Profiles Table
  - Enable RLS
  - Super Admin: full access to all user profiles
  - Admin: read access to users in their location
  - User: read access to own profile only

  ### BET Records Table
  - Enable RLS
  - Super Admin: full access to all records
  - Admin/User: full access to records in their assigned location only

  ## 3. Important Notes
  - All tables use UUIDs for primary keys
  - RLS policies enforce strict location-based access control
  - Super Admin role (role = 'super_admin') has unrestricted access
  - Non-super-admin users are restricted to their assigned location
  - Default values ensure data integrity
  - Timestamps track creation and modification
*/

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
  location_id uuid REFERENCES locations(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bet_records table
CREATE TABLE IF NOT EXISTS bet_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  equipment_id text NOT NULL,
  equipment_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('operational', 'maintenance', 'faulty')),
  last_inspection_date date,
  next_inspection_date date,
  notes text DEFAULT '',
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default locations
INSERT INTO locations (code, name) VALUES
  ('DEL', 'Delhi'),
  ('TRV', 'Trivandrum'),
  ('HYD', 'Hyderabad'),
  ('BLR', 'Bangalore'),
  ('IXE', 'Mangalore')
ON CONFLICT (code) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations table
CREATE POLICY "Super admin can view all locations"
  ON locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Users can view their assigned location"
  ON locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = locations.id
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can insert locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can update locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for user_profiles table
CREATE POLICY "Super admin can view all user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
      AND up.is_active = true
    )
  );

CREATE POLICY "Admins can view users in their location"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = user_profiles.location_id
      AND up.is_active = true
    )
  );

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admin can insert user profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can update user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
      AND up.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
      AND up.is_active = true
    )
  );

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for bet_records table
CREATE POLICY "Super admin can view all bet records"
  ON bet_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Users can view bet records in their location"
  ON bet_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = bet_records.location_id
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can insert bet records"
  ON bet_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Users can insert bet records in their location"
  ON bet_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = bet_records.location_id
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can update bet records"
  ON bet_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Users can update bet records in their location"
  ON bet_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = bet_records.location_id
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = bet_records.location_id
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Super admin can delete bet records"
  ON bet_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can delete bet records in their location"
  ON bet_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.location_id = bet_records.location_id
      AND user_profiles.is_active = true
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON user_profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_bet_records_location ON bet_records(location_id);
CREATE INDEX IF NOT EXISTS idx_bet_records_status ON bet_records(status);
CREATE INDEX IF NOT EXISTS idx_bet_records_created_by ON bet_records(created_by);