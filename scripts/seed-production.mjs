import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nacbcypcopzbyxgbiips.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// All NYC subway lines with valid colors
const SUBWAY_LINES = [
  { line: 'A', color: 'mta-blue' },
  { line: 'B', color: 'mta-orange' },
  { line: 'C', color: 'mta-blue' },
  { line: 'D', color: 'mta-orange' },
  { line: 'E', color: 'mta-blue' },
  { line: 'F', color: 'mta-orange' },
  { line: 'G', color: 'mta-light-green' },
  { line: 'J', color: 'mta-brown' },
  { line: 'L', color: 'mta-grey' },
  { line: 'M', color: 'mta-orange' },
  { line: 'N', color: 'mta-yellow' },
  { line: 'Q', color: 'mta-yellow' },
  { line: 'R', color: 'mta-yellow' },
  { line: 'T', color: 'mta-teal' },
  { line: 'W', color: 'mta-yellow' },
  { line: 'Z', color: 'mta-brown' },
  { line: '1', color: 'mta-red' },
  { line: '2', color: 'mta-red' },
  { line: '3', color: 'mta-red' },
  { line: '4', color: 'mta-dark-green' },
  { line: '5', color: 'mta-dark-green' },
  { line: '6', color: 'mta-dark-green' },
  { line: '7', color: 'mta-purple' }
]

// Sample post content
const POST_TEMPLATES = [
  "just saw the most amazing sunset over the brooklyn bridge 🌅",
  "why is the subway so crowded at 2pm on a tuesday",
  "best pizza spot in the city? go",
  "found a quiet coffee shop in the east village, finally",
  "anyone else think central park is overrated?",
  "the energy in times square at night is unmatched",
  "brooklyn > manhattan and i'll die on this hill",
  "just moved here from the midwest, any tips?",
  "why does it smell like that on 14th street",
  "spotted a celebrity on the L train today omg",
  "rent prices are absolutely insane rn",
  "best bagel debate: murray's or ess-a-bagel?",
  "the skyline from the staten island ferry is underrated",
  "showtime dancers on the train again... mixed feelings",
  "found the best dumpling spot in chinatown",
  "williamsburg has changed so much in 10 years",
  "subway busker was playing my favorite song today",
  "coney island in winter hits different",
  "bodega cat appreciation post 🐱",
  "the highline is beautiful but way too crowded",
  "why is everyone walking so slow today",
  "queens has the best food scene, period",
  "just got caught in the rain without an umbrella, classic",
  "the bronx zoo is way better than people think",
  "late night halal cart hits different at 3am",
  "prospect park > central park don't @ me",
  "rockefeller center at christmas is magical",
  "the struggle of finding a bathroom in midtown is real",
  "brooklyn flea market finds are unmatched",
  "staten island exists? since when?",
  "rooftop season is approaching and i'm ready",
  "the view from one world trade center is insane",
  "washington square park on a sunny day >>",
  "someone explain the subway delays to me please",
  "best place for cheap eats?",
  "the architecture in this city never gets old",
  "just witnessed the most new york interaction ever",
  "smells like summer in the city tonight",
  "the art scene in bushwick is thriving",
  "madison square garden vibes are unreal",
  "why is coffee $8 now what happened",
  "the diversity in queens is what makes nyc special",
  "subway rat just stole someone's pizza lmaooo",
  "the met museum is worth the suggested donation",
  "brooklyn bridge park sunset views are free therapy",
  "street art in the lower east side is incredible",
  "anyone know where to get good tacos around here?",
  "the hustle of this city is motivating tbh",
  "hot dog cart on 53rd and 6th is elite",
  "why are apartments so small here",
  "the energy at yankee stadium is electric"
]

// Comment templates
const COMMENT_TEMPLATES = [
  "this is so real",
  "hard agree",
  "couldn't have said it better myself",
  "facts",
  "nah you're tripping",
  "respectfully disagree",
  "tell me more",
  "where exactly?",
  "been thinking the same thing",
  "this changed my perspective",
  "needed to hear this today",
  "sending this to everyone i know",
  "you get it",
  "lowkey true though",
  "big if true",
  "source?",
  "elaborate please",
  "this ain't it",
  "why would you say something so controversial yet so brave",
  "hot take but i'm here for it"
]

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Create random timestamps spread over the last 7 days
function randomRecentTimestamp() {
  const now = Date.now()
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
  const randomTime = sevenDaysAgo + Math.random() * (now - sevenDaysAgo)
  return new Date(randomTime).toISOString()
}

async function seedData() {
  console.log('🌱 Starting production seed...')

  // Step 1: Create users
  console.log('\n📝 Creating 50 diverse users...')
  const users = []

  for (let i = 0; i < 50; i++) {
    const subway = randomElement(SUBWAY_LINES)
    const deviceId = `seed_device_${i}_${Date.now()}`

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        device_id: deviceId,
        subway_line: subway.line,
        subway_color: subway.color,
        created_at: randomRecentTimestamp()
      })
      .select()
      .single()

    if (error) {
      console.error(`Error creating user ${i}:`, error)
    } else {
      users.push(user)
      process.stdout.write(`Created user ${i + 1}/50 (${subway.line} Line)...\r`)
    }
  }

  console.log(`\n✅ Created ${users.length} users`)

  // Step 2: Create posts
  console.log('\n📮 Creating 100 posts...')
  const posts = []

  for (let i = 0; i < 100; i++) {
    const author = randomElement(users)
    const content = randomElement(POST_TEMPLATES)

    const { data: post, error} = await supabase
      .from('posts')
      .insert({
        title: content.substring(0, 100), // Use first 100 chars as title
        content,
        user_id: author.id,
        user_subway_line: author.subway_line,
        created_at: randomRecentTimestamp()
      })
      .select()
      .single()

    if (error) {
      console.error(`Error creating post ${i}:`, error)
    } else {
      posts.push(post)
      process.stdout.write(`Created post ${i + 1}/100...\r`)
    }
  }

  console.log(`\n✅ Created ${posts.length} posts`)

  // Step 3: Create comments
  console.log('\n💬 Creating 200 comments...')
  let commentsCreated = 0

  for (let i = 0; i < 200; i++) {
    const post = randomElement(posts)
    const author = randomElement(users)
    const content = randomElement(COMMENT_TEMPLATES)

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        content,
        post_id: post.id,
        user_id: author.id,
        depth: 0,
        created_at: randomRecentTimestamp()
      })
      .select()
      .single()

    if (error) {
      console.error(`Error creating comment ${i}:`, error)
    } else {
      commentsCreated++
      process.stdout.write(`Created comment ${i + 1}/200...\r`)
    }
  }

  console.log(`\n✅ Created ${commentsCreated} comments`)

  // Step 4: Create votes on posts
  console.log('\n👍 Creating votes on posts...')
  let postVotesCreated = 0

  for (const post of posts) {
    // Each post gets 3-15 votes
    const numVotes = randomInt(3, 15)
    const votersUsed = new Set()

    for (let i = 0; i < numVotes; i++) {
      const voter = randomElement(users)

      // Skip if this user already voted on this post
      if (votersUsed.has(voter.id)) continue
      votersUsed.add(voter.id)

      const voteType = Math.random() > 0.3 ? 'up' : 'down' // 70% upvotes

      const { error } = await supabase
        .from('votes')
        .insert({
          user_id: voter.id,
          post_id: post.id,
          vote_type: voteType,
          created_at: randomRecentTimestamp()
        })

      if (!error) {
        postVotesCreated++
      }
    }
  }

  console.log(`✅ Created ${postVotesCreated} post votes`)

  // Step 5: Create votes on comments
  console.log('\n💬 Creating votes on comments...')

  const { data: allComments } = await supabase
    .from('comments')
    .select('id')

  let commentVotesCreated = 0

  for (const comment of allComments || []) {
    // Each comment gets 1-8 votes
    const numVotes = randomInt(1, 8)
    const votersUsed = new Set()

    for (let i = 0; i < numVotes; i++) {
      const voter = randomElement(users)

      // Skip if this user already voted on this comment
      if (votersUsed.has(voter.id)) continue
      votersUsed.add(voter.id)

      const voteType = Math.random() > 0.4 ? 'up' : 'down' // 60% upvotes

      const { error } = await supabase
        .from('votes')
        .insert({
          user_id: voter.id,
          comment_id: comment.id,
          vote_type: voteType,
          created_at: randomRecentTimestamp()
        })

      if (!error) {
        commentVotesCreated++
      }
    }
  }

  console.log(`✅ Created ${commentVotesCreated} comment votes`)

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('🎉 Production seed complete!')
  console.log('='.repeat(50))
  console.log(`👥 Users: ${users.length}`)
  console.log(`📮 Posts: ${posts.length}`)
  console.log(`💬 Comments: ${commentsCreated}`)
  console.log(`👍 Post votes: ${postVotesCreated}`)
  console.log(`💬 Comment votes: ${commentVotesCreated}`)
  console.log('='.repeat(50))
}

seedData().catch(console.error)
