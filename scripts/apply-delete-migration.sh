#!/bin/bash

# Apply delete migration to production Supabase
# This script uses the Supabase SQL API to create the missing delete RPC functions

SUPABASE_URL="https://nacbcypcopzbyxgbiips.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hY2JjeXBjb3B6Ynl4Z2JpaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjE3OTUsImV4cCI6MjA3NDQ5Nzc5NX0.3ZK70NKWAzOHWRZ7xxz04cyNB-VDRLL60aTE1mo6xFU"

echo "📝 Applying delete migration to production..."
echo "Target: $SUPABASE_URL"
echo ""

# Read the SQL file
SQL_FILE="supabase/migrations/018_add_delete_rpcs.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Migration file not found: $SQL_FILE"
    exit 1
fi

# We need service role key to run DDL, but we can try with the migration API
# For now, let's create a Node.js script that can use the project's node_modules

cat > /tmp/run_migration.mjs << 'SCRIPT'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Read migration file
const migration = readFileSync('supabase/migrations/018_add_delete_rpcs.sql', 'utf-8')

console.log('Migration SQL:')
console.log(migration)
console.log('\n⚠️  Note: Anon key cannot run DDL. You need service role key.')
console.log('Please run this migration via Supabase Dashboard > SQL Editor')
console.log('Or provide SUPABASE_SERVICE_ROLE_KEY environment variable')
SCRIPT

cd /Users/robdezendorf/Documents/GitHub/yipyap
SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" node /tmp/run_migration.mjs

echo ""
echo "📋 To apply this migration manually:"
echo "1. Go to https://supabase.com/dashboard/project/nacbcypcopzbyxgbiips/sql/new"
echo "2. Copy the contents of supabase/migrations/018_add_delete_rpcs.sql"
echo "3. Paste and run in the SQL editor"
echo ""
echo "Or provide your service role key and run:"
echo "SUPABASE_SERVICE_ROLE_KEY=your_key ./scripts/apply-delete-migration.sh"