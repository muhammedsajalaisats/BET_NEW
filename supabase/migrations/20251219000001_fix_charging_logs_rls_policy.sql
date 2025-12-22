-- Update RLS policies to allow users, admins, and super_admins to work with charging logs
DROP POLICY IF EXISTS "Only users can insert charging logs" ON charging_logs;
DROP POLICY IF EXISTS "Only users can update their own charging logs" ON charging_logs;

-- Allow all authenticated users with location match to insert
CREATE POLICY "Users can insert charging logs"
  ON charging_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = charging_logs.location_id
      AND user_profiles.is_active = true
    )
  );

-- Allow users to update their own logs, admins and super_admins to update any log in their location
CREATE POLICY "Users can update charging logs"
  ON charging_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = charging_logs.location_id
      AND user_profiles.is_active = true
    )
    AND (
      charging_logs.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND (user_profiles.role = 'admin' OR user_profiles.role = 'super_admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = charging_logs.location_id
      AND user_profiles.is_active = true
    )
    AND (
      charging_logs.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND (user_profiles.role = 'admin' OR user_profiles.role = 'super_admin')
      )
    )
  );
