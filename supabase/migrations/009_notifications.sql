-- Subscriptions and notification queue for Edge Functions

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS notif_queue (
  id bigserial PRIMARY KEY,
  kind text NOT NULL, -- 'reply' | 'milestone'
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid,
  comment_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Trigger: on comment insert, notify post owner or parent comment owner
CREATE OR REPLACE FUNCTION enqueue_reply_notif()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_user uuid; post_owner uuid; BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF NEW.parent_id IS NULL THEN
    target_user := post_owner;
  ELSE
    SELECT user_id INTO target_user FROM comments WHERE id = NEW.parent_id;
  END IF;
  IF target_user IS NOT NULL AND target_user <> NEW.user_id THEN
    INSERT INTO notif_queue(kind, user_id, post_id, comment_id, payload)
    VALUES ('reply', target_user, NEW.post_id, NEW.id,
            jsonb_build_object('author_id', NEW.user_id, 'content', NEW.content));
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_enqueue_reply_notif ON comments;
CREATE TRIGGER trg_enqueue_reply_notif
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION enqueue_reply_notif();

-- Trigger: on posts score update crossing thresholds, notify author
CREATE OR REPLACE FUNCTION enqueue_milestone_notif()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE thresholds int[] := ARRAY[5,10]; v_old int; v_new int; author uuid; t int;
BEGIN
  v_old := COALESCE(OLD.score,0); v_new := COALESCE(NEW.score,0);
  IF v_new = v_old THEN RETURN NEW; END IF;
  SELECT user_id INTO author FROM posts WHERE id = NEW.id;
  FOREACH t IN ARRAY thresholds LOOP
    IF v_old < t AND v_new >= t THEN
      INSERT INTO notif_queue(kind, user_id, post_id, payload)
      VALUES ('milestone', author, NEW.id, jsonb_build_object('threshold', t, 'score', v_new));
    END IF;
  END LOOP;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_enqueue_milestone_notif ON posts;
CREATE TRIGGER trg_enqueue_milestone_notif
AFTER UPDATE OF score ON posts
FOR EACH ROW EXECUTE FUNCTION enqueue_milestone_notif();

-- RLS for subscriptions and queue (read own subscriptions, Edge Function service user processes queue)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notif_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid()::uuid = user_id) WITH CHECK (auth.uid()::uuid = user_id);

-- Allow reading queue only to service role; no anon access
REVOKE ALL ON notif_queue FROM anon;

