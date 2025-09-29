-- Fix karma constraint to allow negative values
-- Users should be able to have negative karma from downvotes

-- Remove the constraint that prevents negative karma
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_total_karma_not_negative;

-- Verify the change
DO $$
BEGIN
  -- Check if constraint still exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass
    AND conname = 'users_total_karma_not_negative'
  ) THEN
    RAISE EXCEPTION 'Failed to remove karma constraint';
  END IF;

  RAISE NOTICE 'Karma constraint successfully removed. Users can now have negative karma.';
END $$;