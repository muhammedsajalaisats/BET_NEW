-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Super admin can view all bet records" ON bet_records;
DROP POLICY IF EXISTS "Users can view bet records in their location" ON bet_records;
DROP POLICY IF EXISTS "Super admin can insert bet records" ON bet_records;
DROP POLICY IF EXISTS "Users can insert bet records in their location" ON bet_records;
DROP POLICY IF EXISTS "Super admin can update bet records" ON bet_records;
DROP POLICY IF EXISTS "Users can update bet records in their location" ON bet_records;
DROP POLICY IF EXISTS "Super admin can delete bet records" ON bet_records;
DROP POLICY IF EXISTS "Admins can delete bet records in their location" ON bet_records;

-- Create new policies with updated rules

-- View policies
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

CREATE POLICY "Admin and users can view bet records in their location"
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

-- Insert policies
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

CREATE POLICY "Admin can insert bet records in their location"
  ON bet_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = bet_records.location_id
      AND up.is_active = true
    )
  );

-- Update policies
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

CREATE POLICY "Admin can update bet records in their location"
  ON bet_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = bet_records.location_id
      AND up.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = NEW.location_id
      AND up.is_active = true
    )
  );

-- Delete policy (only for super admin)
CREATE POLICY "Only super admin can delete bet records"
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