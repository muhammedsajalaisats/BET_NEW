-- Add policy for admins to update users in their location
CREATE POLICY "Admins can update users in their location"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = user_profiles.location_id
      AND up.is_active = true
      -- Only allow updating users (not other admins)
      AND user_profiles.role = 'user'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.location_id = NEW.location_id
      AND up.is_active = true
      -- Ensure admin can only set role to 'user'
      AND NEW.role = 'user'
    )
  );