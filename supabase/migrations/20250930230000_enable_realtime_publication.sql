-- Enable realtime for posts, comments, votes tables
DO $$
BEGIN
  -- Add tables to realtime publication (ignore if already added)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
