-- Add complete NYC subway line system
-- Removes 'T' (not a real line), adds missing lines (2, 3, 5, 6, C, D, E, F, M, Q, R, W, Z)

-- First, update the enum types to include all lines
ALTER TYPE subway_line RENAME TO subway_line_old;

CREATE TYPE subway_line AS ENUM (
  -- IRT Lines (Red)
  '1', '2', '3',
  -- IRT Lines (Green)
  '4', '5', '6',
  -- IRT Lines (Purple)
  '7',
  -- IND/BMT Lines (Blue)
  'A', 'C', 'E',
  -- IND/BMT Lines (Orange)
  'B', 'D', 'F', 'M',
  -- IND/BMT Lines (Yellow)
  'N', 'Q', 'R', 'W',
  -- IND/BMT Lines (Light Green)
  'G',
  -- IND/BMT Lines (Brown)
  'J', 'Z',
  -- IND/BMT Lines (Grey)
  'L'
);

-- Migrate existing data
ALTER TABLE users
  ALTER COLUMN subway_line TYPE subway_line USING subway_line::text::subway_line;

-- Drop old enum
DROP TYPE subway_line_old;

-- Update the get_or_create_user function with complete line list
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param TEXT)
RETURNS anonymous_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record anonymous_users;
  subway_lines text[] := ARRAY[
    '1', '2', '3',           -- Red
    '4', '5', '6',           -- Green
    '7',                     -- Purple
    'A', 'C', 'E',           -- Blue
    'B', 'D', 'F', 'M',      -- Orange
    'N', 'Q', 'R', 'W',      -- Yellow
    'G',                     -- Light Green
    'J', 'Z',                -- Brown
    'L'                      -- Grey
  ];
  selected_line text;
  selected_color text;
  random_index integer;
BEGIN
  -- Try to find existing user
  SELECT * INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  -- If user exists, update last_seen_at and return
  IF FOUND THEN
    UPDATE users
    SET last_seen_at = NOW()
    WHERE device_id = device_id_param;

    SELECT * INTO user_record
    FROM anonymous_users
    WHERE device_id = device_id_param;

    RETURN user_record;
  END IF;

  -- Select a random subway line
  random_index := 1 + floor(random() * array_length(subway_lines, 1));
  selected_line := subway_lines[random_index];

  -- Map subway line to correct MTA color
  CASE selected_line
    -- Red lines
    WHEN '1' THEN selected_color := 'mta-red';
    WHEN '2' THEN selected_color := 'mta-red';
    WHEN '3' THEN selected_color := 'mta-red';
    -- Green lines
    WHEN '4' THEN selected_color := 'mta-dark-green';
    WHEN '5' THEN selected_color := 'mta-dark-green';
    WHEN '6' THEN selected_color := 'mta-dark-green';
    -- Purple line
    WHEN '7' THEN selected_color := 'mta-purple';
    -- Blue lines
    WHEN 'A' THEN selected_color := 'mta-blue';
    WHEN 'C' THEN selected_color := 'mta-blue';
    WHEN 'E' THEN selected_color := 'mta-blue';
    -- Orange lines
    WHEN 'B' THEN selected_color := 'mta-orange';
    WHEN 'D' THEN selected_color := 'mta-orange';
    WHEN 'F' THEN selected_color := 'mta-orange';
    WHEN 'M' THEN selected_color := 'mta-orange';
    -- Yellow lines
    WHEN 'N' THEN selected_color := 'mta-yellow';
    WHEN 'Q' THEN selected_color := 'mta-yellow';
    WHEN 'R' THEN selected_color := 'mta-yellow';
    WHEN 'W' THEN selected_color := 'mta-yellow';
    -- Light green line
    WHEN 'G' THEN selected_color := 'mta-light-green';
    -- Brown lines
    WHEN 'J' THEN selected_color := 'mta-brown';
    WHEN 'Z' THEN selected_color := 'mta-brown';
    -- Grey line
    WHEN 'L' THEN selected_color := 'mta-grey';
    ELSE selected_color := 'mta-blue';
  END CASE;

  INSERT INTO users (device_id, subway_line, subway_color, created_at, last_seen_at)
  VALUES (device_id_param, selected_line, selected_color, NOW(), NOW());

  SELECT * INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  RETURN user_record;
END;
$$;