-- Rate limit helpers (rolling 1 hour windows)
CREATE OR REPLACE FUNCTION within_last_hour(ts timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ts >= (now() - interval '1 hour')
$$;

-- Reroll tracking table
CREATE TABLE IF NOT EXISTS thread_identity_rerolls (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  rerolled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- Deterministic seed and identity derivation
CREATE OR REPLACE FUNCTION hash_text(input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(input, 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION derive_identity(seed text)
RETURNS TABLE(emoji text, color_code text) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];
  eidx int;
  cidx int;
BEGIN
  -- simple modulus over hex
  eidx := (('x' || substr(seed, 1, 8))::bit(32))::int;
  cidx := (('x' || substr(seed, 9, 8))::bit(32))::int;
  eidx := (abs(eidx) % array_length(emojis,1)) + 1;
  cidx := (abs(cidx) % array_length(colors,1)) + 1;
  RETURN QUERY SELECT emojis[eidx], colors[cidx];
END;
$$;

-- Ensure deterministic thread identity for a (user,post)
CREATE OR REPLACE FUNCTION rpc_ensure_thread_identity(user_uuid uuid, post_uuid uuid)
RETURNS TABLE(emoji text, color_code text) LANGUAGE plpgsql AS $$
DECLARE
  dev text;
  seed text;
  e text;
  c text;
BEGIN
  SELECT device_id INTO dev FROM users WHERE id = user_uuid;
  IF dev IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  seed := hash_text(dev || post_uuid::text);
  SELECT * INTO e,c FROM derive_identity(seed);
  INSERT INTO thread_identities(user_id, post_id, emoji, color_code)
  VALUES (user_uuid, post_uuid, e, c)
  ON CONFLICT (user_id, post_id) DO UPDATE SET emoji = EXCLUDED.emoji, color_code = EXCLUDED.color_code;
  RETURN QUERY SELECT e, c;
END;
$$;

-- Reroll deterministic identity only once per (user,post)
CREATE OR REPLACE FUNCTION rpc_reroll_thread_identity(user_uuid uuid, post_uuid uuid)
RETURNS TABLE(emoji text, color_code text) LANGUAGE plpgsql AS $$
DECLARE
  dev text;
  seed text;
  e text;
  c text;
BEGIN
  IF EXISTS (SELECT 1 FROM thread_identity_rerolls WHERE user_id = user_uuid AND post_id = post_uuid) THEN
    RAISE EXCEPTION 'Reroll already used for this thread';
  END IF;
  SELECT device_id INTO dev FROM users WHERE id = user_uuid;
  IF dev IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  seed := hash_text(dev || post_uuid::text || now()::text);
  SELECT * INTO e,c FROM derive_identity(seed);
  INSERT INTO thread_identities(user_id, post_id, emoji, color_code)
  VALUES (user_uuid, post_uuid, e, c)
  ON CONFLICT (user_id, post_id) DO UPDATE SET emoji = EXCLUDED.emoji, color_code = EXCLUDED.color_code;
  INSERT INTO thread_identity_rerolls(user_id, post_id) VALUES (user_uuid, post_uuid);
  RETURN QUERY SELECT e, c;
END;
$$;

-- Rate limits: posts 10/h, comments 30/h, votes 50/h
CREATE OR REPLACE FUNCTION rpc_create_post(p_user uuid, p_content text)
RETURNS posts LANGUAGE plpgsql AS $$
DECLARE
  cnt int;
  rec posts;
BEGIN
  IF length(p_content) < 1 OR length(p_content) > 100 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;
  SELECT count(*) INTO cnt FROM posts WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 10 THEN RAISE EXCEPTION 'Post rate limit exceeded'; END IF;
  INSERT INTO posts(user_id, community, title, content)
  VALUES (p_user, 'dimes_square', substr(p_content,1,100), p_content)
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_create_comment(p_user uuid, p_post uuid, p_parent uuid, p_content text)
RETURNS comments LANGUAGE plpgsql AS $$
DECLARE
  cnt int;
  rec comments;
  parent_depth int;
BEGIN
  IF length(p_content) < 1 OR length(p_content) > 100 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;
  SELECT count(*) INTO cnt FROM comments WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 30 THEN RAISE EXCEPTION 'Comment rate limit exceeded'; END IF;
  IF p_parent IS NOT NULL THEN
    SELECT depth INTO parent_depth FROM comments WHERE id = p_parent;
    IF parent_depth IS NULL THEN RAISE EXCEPTION 'Parent not found'; END IF;
    IF parent_depth >= 1 THEN RAISE EXCEPTION 'Max depth exceeded'; END IF;
  END IF;
  INSERT INTO comments(user_id, post_id, parent_id, content)
  VALUES (p_user, p_post, p_parent, p_content)
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_vote_post(p_user uuid, p_post uuid, p_vote smallint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE cnt int; BEGIN
  IF p_vote NOT IN (-1,0,1) THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  SELECT count(*) INTO cnt FROM votes WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 50 THEN RAISE EXCEPTION 'Vote rate limit exceeded'; END IF;
  IF p_vote = 0 THEN
    DELETE FROM votes WHERE user_id = p_user AND post_id = p_post;
  ELSE
    INSERT INTO votes(user_id, post_id, vote_type) VALUES (p_user, p_post, p_vote)
    ON CONFLICT (user_id, post_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, updated_at = now();
  END IF;
END;$$;

CREATE OR REPLACE FUNCTION rpc_vote_comment(p_user uuid, p_comment uuid, p_vote smallint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE cnt int; BEGIN
  IF p_vote NOT IN (-1,0,1) THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  SELECT count(*) INTO cnt FROM votes WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 50 THEN RAISE EXCEPTION 'Vote rate limit exceeded'; END IF;
  IF p_vote = 0 THEN
    DELETE FROM votes WHERE user_id = p_user AND comment_id = p_comment;
  ELSE
    INSERT INTO votes(user_id, comment_id, vote_type) VALUES (p_user, p_comment, p_vote)
    ON CONFLICT (user_id, comment_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, updated_at = now();
  END IF;
END;$$;
