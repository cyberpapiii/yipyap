-- PRE-MIGRATION PRODUCTION CHECK
-- Run this to validate production state before applying subway migrations

SELECT 'PRODUCTION PRE-MIGRATION CHECK' as status;

-- Check current user count and emoji/color distribution
SELECT
  'User Count' as metric,
  COUNT(*)::text as value
FROM users
UNION ALL
SELECT
  'Users with Emoji',
  COUNT(CASE WHEN emoji IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Users with Color',
  COUNT(CASE WHEN color IS NOT NULL THEN 1 END)::text
FROM users;

-- Check for existing subway columns (should NOT exist)
SELECT
  'Column Check' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'subway_line'
    ) THEN 'SUBWAY_LINE EXISTS - MIGRATION ALREADY APPLIED!'
    ELSE 'SUBWAY_LINE MISSING - READY FOR MIGRATION'
  END as subway_line_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'subway_color'
    ) THEN 'SUBWAY_COLOR EXISTS - MIGRATION ALREADY APPLIED!'
    ELSE 'SUBWAY_COLOR MISSING - READY FOR MIGRATION'
  END as subway_color_status;

-- Show current emoji/color distribution (top 5)
SELECT
  emoji,
  color,
  COUNT(*) as user_count
FROM users
WHERE emoji IS NOT NULL AND color IS NOT NULL
GROUP BY emoji, color
ORDER BY user_count DESC
LIMIT 5;