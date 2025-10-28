-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert charging logs" ON charging_logs;
DROP POLICY IF EXISTS "Users can update their own charging logs" ON charging_logs;

-- Create new insert policy that only allows users to create charging logs
CREATE POLICY "Only users can insert charging logs"
  ON charging_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'user'
      AND user_profiles.location_id = charging_logs.location_id
      AND user_profiles.is_active = true
    )
  );

-- Create new update policy that only allows users to update their own logs
CREATE POLICY "Only users can update their own charging logs"
  ON charging_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'user'
      AND user_profiles.is_active = true
    )
    AND charging_logs.user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'user'
      AND user_profiles.is_active = true
    )
    AND charging_logs.user_id = auth.uid()
  );