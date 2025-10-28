-- Create charging_logs table for BET equipment charging time tracking
CREATE TABLE IF NOT EXISTS charging_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES bet_records(id),
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_charging_logs_equipment ON charging_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_charging_logs_user ON charging_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_charging_logs_location ON charging_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_charging_logs_start_time ON charging_logs(start_time);

-- Enable Row Level Security
ALTER TABLE charging_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- View policies
CREATE POLICY "Super admin can view all charging logs"
  ON charging_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Users can view charging logs in their location"
  ON charging_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.location_id = charging_logs.location_id
      AND user_profiles.is_active = true
    )
  );

-- Insert policies
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

-- Update policies
CREATE POLICY "Users can update their own charging logs"
  ON charging_logs FOR UPDATE
  TO authenticated
  USING (
    charging_logs.user_id = auth.uid()
    AND (
      SELECT is_active FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    charging_logs.user_id = auth.uid()
    AND (
      SELECT is_active FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create function to calculate duration
CREATE OR REPLACE FUNCTION calculate_charging_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate duration
CREATE TRIGGER charging_duration_trigger
  BEFORE INSERT OR UPDATE
  ON charging_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_charging_duration();