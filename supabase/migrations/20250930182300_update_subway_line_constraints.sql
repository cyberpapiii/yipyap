-- Drop old constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subway_line_valid;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subway_color_valid;

-- Add updated constraints with all 22 NYC subway lines
ALTER TABLE users ADD CONSTRAINT users_subway_line_valid
  CHECK (subway_line IS NULL OR subway_line IN (
    '1', '2', '3', '4', '5', '6', '7',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W', 'Z'
  ));

ALTER TABLE users ADD CONSTRAINT users_subway_color_valid
  CHECK (subway_color IS NULL OR subway_color IN (
    'mta-red', 'mta-dark-green', 'mta-purple', 'mta-blue', 'mta-orange',
    'mta-yellow', 'mta-light-green', 'mta-brown', 'mta-grey'
  ));
