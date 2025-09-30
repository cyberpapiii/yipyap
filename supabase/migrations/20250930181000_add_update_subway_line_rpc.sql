-- RPC to update user's subway line
CREATE OR REPLACE FUNCTION rpc_update_subway_line(
  p_user uuid,
  p_subway_line text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subway_color text;
BEGIN
  -- Validate subway line
  IF p_subway_line NOT IN ('1', '2', '3', '4', '5', '6', '7', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W', 'Z') THEN
    RAISE EXCEPTION 'Invalid subway line';
  END IF;

  -- Map subway line to correct color
  v_subway_color := CASE
    WHEN p_subway_line IN ('1', '2', '3') THEN 'mta-red'
    WHEN p_subway_line IN ('4', '5', '6') THEN 'mta-dark-green'
    WHEN p_subway_line = '7' THEN 'mta-purple'
    WHEN p_subway_line IN ('A', 'C', 'E') THEN 'mta-blue'
    WHEN p_subway_line IN ('B', 'D', 'F', 'M') THEN 'mta-orange'
    WHEN p_subway_line IN ('N', 'Q', 'R', 'W') THEN 'mta-yellow'
    WHEN p_subway_line = 'G' THEN 'mta-light-green'
    WHEN p_subway_line IN ('J', 'Z') THEN 'mta-brown'
    WHEN p_subway_line = 'L' THEN 'mta-grey'
    ELSE 'mta-blue'
  END;

  -- Update user's subway line and color
  UPDATE users
  SET
    subway_line = p_subway_line,
    subway_color = v_subway_color,
    updated_at = now()
  WHERE id = p_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Grant execute permission to anon
GRANT EXECUTE ON FUNCTION rpc_update_subway_line(uuid, text) TO anon;
