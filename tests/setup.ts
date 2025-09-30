/**
 * Vitest test setup
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest'

// Setup test environment
beforeAll(() => {
	// Set test environment variables
	process.env.PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
	process.env.PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6NTQzMjEvYXV0aC92MSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJpYXQiOjE3NTg4MjcxMzksImV4cCI6MjA3NDQwMzEzOX0.byK4I20bS0CpsjSErsR7acfZNxDLlDTLHQJu6kcYM8M'
})

// Cleanup after all tests
afterAll(() => {
	// Any global cleanup
})