#!/usr/bin/env node
import jwt from 'jsonwebtoken'

const secret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'
const issuer = process.env.SUPABASE_JWT_ISSUER || 'http://127.0.0.1:54321/auth/v1'
const audience = process.env.SUPABASE_JWT_AUDIENCE || 'authenticated'

const role = process.argv[2]
if (!role || !['anon', 'service'].includes(role)) {
  console.error('Usage: node scripts/generate-supabase-token.mjs <anon|service> [hoursValid=87600]')
  process.exit(1)
}

const hoursValid = Number(process.argv[3] || 87600) // default 10 years
const expiresIn = `${hoursValid}h`

const token = jwt.sign(
  {
    role: role === 'service' ? 'service_role' : 'anon',
    iss: issuer,
    aud: audience,
    sub: '00000000-0000-0000-0000-000000000000'
  },
  secret,
  { expiresIn }
)

console.log(token)
