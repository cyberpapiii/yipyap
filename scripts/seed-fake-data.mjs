#!/usr/bin/env node

/**
 * Seed script for BingBong - Creates fake NYC-themed posts and users
 * Usage: SUPABASE_URL=your_url SUPABASE_ANON_KEY=your_key node scripts/seed-fake-data.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// NYC-themed post content
const POST_TEMPLATES = [
  // Food & Restaurants
  "just had the best dollar slice at joe's on carmine street. still undefeated",
  "why does halal guys taste different at every cart? conspiracy",
  "spotted someone eating pizza with a fork and knife in midtown. calling the cops",
  "levain cookies are overrated and i said what i said",
  "bodega cat sighting on 3rd ave. day = made",
  "the breakfast sandwich guy at my bodega knows my order now. we're basically married",
  "if you're not getting bacon egg and cheese on a roll are you even a new yorker",
  "just paid $8 for a coffee in soho and i'm not even mad about it",

  // Transit
  "missed my train because someone was holding the door. every. single. day.",
  "l train is down again. what else is new",
  "just saw a full mariachi band perform on the 7 train. love this city",
  "showtime dancers almost kicked me in the face but i respect the hustle",
  "standing in the middle of the subway car is a CRIME",
  "guy on the q train just did his full morning routine. toothbrush and everything",
  "the f in mta stands for functioning",
  "saw someone actually give up their seat today. simulation confirmed broken",

  // Weather & Seasons
  "it's 40 degrees and everyone's in shorts. new yorkers are built different",
  "first day above 60 and all of washington square park is out here",
  "black ice season has officially begun. godspeed everyone",
  "the rats are unionizing during this heatwave i swear",

  // Neighborhoods
  "times square is hell on earth and i will die on this hill",
  "williamsburg is just times square for people with tote bags",
  "just got priced out of my neighborhood through osmosis",
  "astoria really is the last affordable neighborhood huh",
  "moved to bushwick and now i exclusively drink oat milk",

  // NYC Culture
  "if you stop walking in the middle of the sidewalk you deserve jail time",
  "standing on the left side of the escalator is a hate crime",
  "just made direct eye contact on the subway. moving to jersey",
  "heard someone say excuse me in midtown. tourists are getting bolder",
  "pay the dollar for the napkins. do not be cheap with the halal guy",
  "saw someone reading a physical book on the train. respect",

  // Housing
  "just paid $3000 for a place where i can touch all 4 walls from my bed",
  "my roommate's band is rehearsing in the living room again",
  "super said he'd fix the heat 3 weeks ago. still freezing",
  "can hear my neighbor's entire phone call through these walls",

  // Events & Nightlife
  "why does every bar in the east village smell exactly the same",
  "cover charge was $40 and the dj played wonderwall",
  "got to the party at 11pm and i was the only one there. never again",
  "house shows in ridgewood hit different",

  // Parks & Recreation
  "prospect park > central park and it's not even close",
  "watching someone try to ride a bike in central park for the first time >>> tv",
  "domino park is just a fancy place for dogs to hang out",

  // Random Observations
  "the pigeons here are unionized and don't fear death",
  "just saw someone walking 6 dogs at once. superhuman",
  "guy sleeping on the subway has better posture than me",
  "street meat cart at 2am hits different than michelin star",
  "the rats in the subway are getting bold. saw one take the 6 train uptown",
]

const COMMENTS = [
  "real",
  "this is it",
  "facts",
  "no lies detected",
  "felt this",
  "big if true",
  "couldn't have said it better",
  "preaching",
  "this the one",
  "thank you for saying this",
  "finally someone said it",
  "absolutely not",
  "delete this",
  "terrible take",
  "how do i unread something",
  "you're out of pocket for this",
  "respectfully no",
  "the wrongest take possible",
  "said nobody ever",
  "where?",
  "source?",
  "proof or ban",
  "pics or it didn't happen",
  "which line tho",
  "what neighborhood",
  "exact location please",
  "need the cross streets",
  "lmaooo",
  "nahhh",
  "bruh",
  "ayo",
  "fr fr",
  "on god",
  "no cap",
  "literally",
]

const SUBWAY_LINES = ['1', '2', '3', '4', '5', '6', '7', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W', 'Z']

// Generate fake device IDs
function generateDeviceId() {
  return `seed-device-${Math.random().toString(36).substring(2, 15)}`
}

// Create fake users
async function createFakeUsers(count = 15) {
  console.log(`\n🚇 Creating ${count} fake users...`)
  const users = []

  for (let i = 0; i < count; i++) {
    const deviceId = generateDeviceId()

    try {
      const { data, error } = await supabase.rpc('get_or_create_user', {
        device_id_param: deviceId
      })

      if (error) throw error

      users.push(data)
      console.log(`   ✓ Created user on ${data.subway_line} line`)
    } catch (error) {
      console.error(`   ✗ Failed to create user: ${error.message}`)
    }

    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return users
}

// Create fake posts
async function createFakePosts(users, count = 30) {
  console.log(`\n📝 Creating ${count} fake posts...`)
  const posts = []

  // Shuffle post templates
  const shuffled = [...POST_TEMPLATES].sort(() => Math.random() - 0.5)
  const selectedPosts = shuffled.slice(0, count)

  for (let i = 0; i < selectedPosts.length; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const content = selectedPosts[i]

    try {
      const { data, error } = await supabase.rpc('rpc_create_post', {
        p_user: user.id,
        p_content: content
      })

      if (error) throw error

      posts.push(data)
      console.log(`   ✓ Post by ${user.subway_line} line: "${content.substring(0, 40)}..."`)
    } catch (error) {
      console.error(`   ✗ Failed to create post: ${error.message}`)
    }

    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 150))
  }

  return posts
}

// Create fake comments
async function createFakeComments(users, posts, commentsPerPost = 2) {
  console.log(`\n💬 Creating comments...`)
  let commentCount = 0

  // Select random posts to comment on (about 70% of posts)
  const postsToComment = posts
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(posts.length * 0.7))

  for (const post of postsToComment) {
    const numComments = Math.floor(Math.random() * commentsPerPost) + 1

    for (let i = 0; i < numComments; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const content = COMMENTS[Math.floor(Math.random() * COMMENTS.length)]

      try {
        const { error } = await supabase.rpc('rpc_create_comment', {
          p_user: user.id,
          p_post: post.id,
          p_parent: null,
          p_content: content
        })

        if (error) throw error

        commentCount++
        console.log(`   ✓ Comment on post: "${content}"`)
      } catch (error) {
        console.error(`   ✗ Failed to create comment: ${error.message}`)
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }

  console.log(`\n   Created ${commentCount} total comments`)
}

// Add fake votes
async function createFakeVotes(users, posts) {
  console.log(`\n⬆️ Adding votes to posts...`)
  let voteCount = 0

  // Each user votes on random 40% of posts
  for (const user of users) {
    const postsToVote = posts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(posts.length * 0.4))

    for (const post of postsToVote) {
      // 70% upvote, 30% downvote
      const voteType = Math.random() < 0.7 ? 'up' : 'down'

      try {
        const { error } = await supabase.rpc('rpc_vote_post', {
          p_user: user.id,
          p_post: post.id,
          p_vote: voteType
        })

        if (error) throw error

        voteCount++
      } catch (error) {
        // Silently fail - user might have already voted
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`   ✓ Added ${voteCount} votes`)
}

// Main seed function
async function seed() {
  console.log('🌱 Starting BingBong seed script...')
  console.log(`📍 Target: ${SUPABASE_URL}`)

  try {
    // Check connection
    const { error: connectionError } = await supabase.from('users').select('count', { count: 'exact', head: true })
    if (connectionError) {
      throw new Error(`Connection failed: ${connectionError.message}`)
    }

    console.log('✓ Connected to Supabase')

    // Create fake data
    const users = await createFakeUsers(15)
    const posts = await createFakePosts(users, 30)
    await createFakeComments(users, posts, 3)
    await createFakeVotes(users, posts)

    console.log('\n✅ Seeding complete!')
    console.log(`\n📊 Summary:`)
    console.log(`   • ${users.length} users`)
    console.log(`   • ${posts.length} posts`)
    console.log(`   • Visit your app to see the results!`)

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message)
    process.exit(1)
  }
}

// Run seed
seed()