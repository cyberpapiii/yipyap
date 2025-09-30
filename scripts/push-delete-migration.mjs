#!/usr/bin/env node

/**
 * Push delete RPC migration to production Supabase
 * This applies migration 018_add_delete_rpcs.sql
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL environment variable')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  console.error('\n📋 To get your service role key:')
  console.error('1. Go to https://supabase.com/dashboard/project/nacbcypcopzbyxgbiips/settings/api')
  console.error('2. Copy the "service_role" key (not the anon key)')
  console.error('3. Run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/push-delete-migration.mjs')
  console.error('\n')
  console.error('Or apply manually via SQL Editor:')
  console.error('https://supabase.com/dashboard/project/nacbcypcopzbyxgbiips/sql/new')
  console.error('\nCopy/paste this SQL:')
  console.log('\n' + readFileSync('supabase/migrations/018_add_delete_rpcs.sql', 'utf-8'))
  process.exit(1)
}

console.log('🚀 Pushing delete migration to production...')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const migration = readFileSync('supabase/migrations/018_add_delete_rpcs.sql', 'utf-8')

try {
  // Split into individual statements and execute
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  for (const statement of statements) {
    if (!statement) continue
    console.log(`Executing: ${statement.substring(0, 60)}...`)

    const { error } = await supabase.rpc('exec_sql', {
      query: statement + ';'
    })

    if (error) {
      // Try direct execution if exec_sql doesn't work
      console.log('Trying alternative method...')
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query: statement + ';' })
      })

      if (!response.ok) {
        throw new Error(`Failed to execute: ${await response.text()}`)
      }
    }
  }

  console.log('\n✅ Migration applied successfully!')
  console.log('\nTesting functions...')

  // Test rpc_delete_post exists
  const { error: testError } = await supabase.rpc('rpc_delete_post', {
    p_user: '00000000-0000-0000-0000-000000000000',
    p_post: '00000000-0000-0000-0000-000000000000'
  })

  if (testError) {
    if (testError.message.includes('not found') || testError.message.includes('permission')) {
      console.log('✅ rpc_delete_post is callable')
    } else {
      console.log('⚠️  Warning:', testError.message)
    }
  } else {
    console.log('✅ rpc_delete_post is callable')
  }

  console.log('\n🎉 Delete functionality should now work in production!')

} catch (error) {
  console.error('\n❌ Migration failed:', error.message)
  console.error('\n📋 Please apply manually via Supabase Dashboard SQL Editor')
  process.exit(1)
}