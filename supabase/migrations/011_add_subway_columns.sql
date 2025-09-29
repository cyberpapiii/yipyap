-- Migration: Add subway_line and subway_color columns to users table
-- This is Step 1 of the emoji/color to subway migration
--
-- SAFETY: This migration is backward compatible - it only adds new columns
-- without removing existing ones. Applications can continue using emoji/color
-- fields during the transition period.

-- Add new subway columns with default values
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subway_line TEXT,
  ADD COLUMN IF NOT EXISTS subway_color TEXT;

-- Add constraints for subway_line (NYC subway lines)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_subway_line_valid,
  ADD CONSTRAINT users_subway_line_valid CHECK (
    subway_line IS NULL OR
    subway_line = ANY (ARRAY['A','B','G','J','L','N','1','4','7','T'])
  );

-- Add constraints for subway_color (MTA official colors)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_subway_color_valid,
  ADD CONSTRAINT users_subway_color_valid CHECK (
    subway_color IS NULL OR
    subway_color = ANY (ARRAY[
      'mta-blue',        -- A, C lines
      'mta-orange',      -- B, D, F, M lines
      'mta-light-green', -- G line
      'mta-brown',       -- J, Z lines
      'mta-grey',        -- L line
      'mta-yellow',      -- N, Q, R, W lines
      'mta-red',         -- 1, 2, 3 lines
      'mta-dark-green',  -- 4, 5, 6 lines
      'mta-purple',      -- 7 line
      'mta-teal'         -- T line (shuttle)
    ])
  );

-- Create indexes for new columns (for future performance)
CREATE INDEX IF NOT EXISTS idx_users_subway_line ON users(subway_line);
CREATE INDEX IF NOT EXISTS idx_users_subway_color ON users(subway_color);

-- Add helpful comment for future reference
COMMENT ON COLUMN users.subway_line IS 'NYC subway line identifier (A,B,G,J,L,N,1,4,7,T)';
COMMENT ON COLUMN users.subway_color IS 'MTA official color name (e.g., mta-blue, mta-orange)';