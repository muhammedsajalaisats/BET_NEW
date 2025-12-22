-- Add Meter_reading column to charging_logs table
ALTER TABLE charging_logs
ADD COLUMN Meter_reading DECIMAL(10, 2);

-- Add charging_point_id column to charging_logs table
ALTER TABLE charging_logs
ADD COLUMN charging_point_id VARCHAR(255);

-- Create index for charging_point_id for better query performance
CREATE INDEX IF NOT EXISTS idx_charging_logs_charging_point ON charging_logs(charging_point_id);
