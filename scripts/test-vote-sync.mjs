#!/usr/bin/env node
/**
 * Test script to debug vote count synchronization issue
 * Simulates: vote in feed → navigate to thread → navigate back → check if vote persists
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function setupTestData() {
  console.log('\n=== SETUP: Creating test data ===\n')

  // Create test user via RPC
  const deviceId = `test_device_${Date.now()}`
  const { data: user, error: userError } = await supabase.rpc('get_or_create_user', {
    device_id_param: deviceId
  })

  if (userError) {
    console.error('Failed to create user:', userError)
    return null
  }

  console.log(`Created user: ${user.id} (subway: ${user.subway_line})`)

  // Create a test post
  const { data: post, error: postError } = await supabase.rpc('rpc_create_post', {
    p_user: user.id,
    p_content: `Test post for vote sync ${Date.now()}`,
    p_community: 'nyc'
  })

  if (postError) {
    console.error('Failed to create post:', postError)
    return null
  }

  console.log(`Created post: ${post.id}`)
  console.log(`Initial score: ${post.score}`)

  return { user, post, deviceId }
}

async function simulateVoteFlow(user, postId) {
  console.log('\n=== STEP 1: Check initial state ===\n')

  // Fetch post from view (what the feed does)
  const { data: initialPost } = await supabase
    .from('post_with_stats')
    .select('*')
    .eq('id', postId)
    .single()

  console.log(`post_with_stats.vote_score: ${initialPost?.vote_score}`)

  // Check votes table
  const { data: initialVotes } = await supabase
    .from('votes')
    .select('*')
    .eq('post_id', postId)

  console.log(`Votes in table: ${initialVotes?.length || 0}`)

  // Check user's vote
  const { data: userVote } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  console.log(`User's current vote: ${userVote?.vote_type ?? 'none'}`)

  console.log('\n=== STEP 2: User upvotes (simulating rpc_vote_post) ===\n')

  const { error: voteError } = await supabase.rpc('rpc_vote_post', {
    p_user: user.id,
    p_post: postId,
    p_vote: 1 // upvote
  })

  if (voteError) {
    console.error('Vote failed:', voteError)
    return
  }

  console.log('Vote RPC completed successfully')

  // Small delay to let trigger execute
  await new Promise(r => setTimeout(r, 100))

  // Check state immediately after vote
  const { data: afterVotePost } = await supabase
    .from('post_with_stats')
    .select('*')
    .eq('id', postId)
    .single()

  console.log(`post_with_stats.vote_score AFTER vote: ${afterVotePost?.vote_score}`)

  // Check posts table directly
  const { data: postsTableAfter } = await supabase
    .from('posts')
    .select('score')
    .eq('id', postId)
    .single()

  console.log(`posts.score AFTER vote: ${postsTableAfter?.score}`)

  // Check votes table
  const { data: votesAfter } = await supabase
    .from('votes')
    .select('*')
    .eq('post_id', postId)

  console.log(`Votes in table: ${votesAfter?.length}`)
  console.log(`SUM of vote_type: ${votesAfter?.reduce((sum, v) => sum + v.vote_type, 0)}`)

  console.log('\n=== STEP 3: Simulate "navigate to thread" (fetch single post) ===\n')

  const { data: threadPost } = await supabase
    .from('post_with_stats')
    .select('*')
    .eq('id', postId)
    .single()

  console.log(`Thread view - post_with_stats.vote_score: ${threadPost?.vote_score}`)

  // Fetch user's vote (what addUserVotesToPosts does)
  const { data: userVoteAfter } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  const userVoteStr = userVoteAfter?.vote_type === 1 ? 'up' : userVoteAfter?.vote_type === -1 ? 'down' : null
  console.log(`Thread view - user_vote: ${userVoteStr}`)

  console.log('\n=== STEP 4: Simulate "navigate back to feed" (fetch feed posts) ===\n')

  // This is exactly what getFeedPosts does
  const { data: feedPosts } = await supabase
    .from('post_with_stats')
    .select('*')
    .eq('community', 'nyc')
    .is('parent_post_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  const feedPost = feedPosts?.find(p => p.id === postId)
  console.log(`Feed refresh - post_with_stats.vote_score: ${feedPost?.vote_score}`)

  // Fetch user votes for feed posts (what addUserVotesToPosts does)
  const feedPostIds = feedPosts?.map(p => p.id) || []
  const { data: feedUserVotes } = await supabase
    .from('votes')
    .select('post_id, vote_type')
    .in('post_id', feedPostIds)
    .eq('user_id', user.id)

  const feedUserVote = feedUserVotes?.find(v => v.post_id === postId)
  const feedUserVoteStr = feedUserVote?.vote_type === 1 ? 'up' : feedUserVote?.vote_type === -1 ? 'down' : null
  console.log(`Feed refresh - user_vote: ${feedUserVoteStr}`)

  console.log('\n=== FINAL VERIFICATION ===\n')

  // Direct query to posts table
  const { data: finalPostsTable } = await supabase
    .from('posts')
    .select('score, vote_count')
    .eq('id', postId)
    .single()

  console.log(`posts table - score: ${finalPostsTable?.score}, vote_count: ${finalPostsTable?.vote_count}`)

  // Direct query to post_with_stats view
  const { data: finalView } = await supabase
    .from('post_with_stats')
    .select('vote_score')
    .eq('id', postId)
    .single()

  console.log(`post_with_stats view - vote_score: ${finalView?.vote_score}`)

  // Direct SUM from votes
  const { data: finalVotes } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('post_id', postId)

  const sumVotes = finalVotes?.reduce((sum, v) => sum + v.vote_type, 0) || 0
  console.log(`votes table - SUM(vote_type): ${sumVotes}`)

  // Check consistency
  const allMatch = finalPostsTable?.score === finalView?.vote_score &&
                   finalView?.vote_score === sumVotes

  console.log(`\nAll values consistent: ${allMatch ? '✅ YES' : '❌ NO'}`)

  if (!allMatch) {
    console.log('\n⚠️  INCONSISTENCY DETECTED!')
    console.log('This indicates a trigger or view issue.')
  }

  return {
    postsScore: finalPostsTable?.score,
    viewScore: finalView?.vote_score,
    votesSum: sumVotes,
    userVote: feedUserVoteStr
  }
}

async function cleanup(postId, userId) {
  console.log('\n=== CLEANUP ===\n')

  // Delete votes first (foreign key)
  await supabase.from('votes').delete().eq('post_id', postId)

  // Delete post
  await supabase.from('posts').delete().eq('id', postId)

  // Delete user
  await supabase.from('users').delete().eq('id', userId)

  console.log('Test data cleaned up')
}

async function main() {
  console.log('========================================')
  console.log('Vote Sync Debugging Test')
  console.log('========================================')

  const testData = await setupTestData()
  if (!testData) {
    console.error('Setup failed')
    process.exit(1)
  }

  const { user, post } = testData

  try {
    const result = await simulateVoteFlow(user, post.id)

    console.log('\n========================================')
    console.log('TEST RESULTS')
    console.log('========================================')
    console.log(`Expected vote_score: 1 (one upvote)`)
    console.log(`Actual posts.score: ${result.postsScore}`)
    console.log(`Actual view.vote_score: ${result.viewScore}`)
    console.log(`Actual SUM(votes): ${result.votesSum}`)
    console.log(`User vote indicator: ${result.userVote}`)

    if (result.postsScore === 1 && result.viewScore === 1 && result.votesSum === 1 && result.userVote === 'up') {
      console.log('\n✅ DATABASE LAYER IS WORKING CORRECTLY')
      console.log('The issue must be in the client-side code (stores, realtime, or UI)')
    } else {
      console.log('\n❌ DATABASE LAYER HAS ISSUES')
    }

  } finally {
    await cleanup(post.id, user.id)
  }
}

main().catch(console.error)
