/**
 * Anonymous Authentication Tests
 * Tests user creation, device fingerprinting, and identity management
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import type { AnonymousUser } from '$lib/types'

const supabase = createClient(
	'http://127.0.0.1:54321',
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6NTQzMjEvYXV0aC92MSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJpYXQiOjE3NTg4MjcxMzksImV4cCI6MjA3NDQwMzEzOX0.byK4I20bS0CpsjSErsR7acfZNxDLlDTLHQJu6kcYM8M'
)

const dbClient = new Client({
	host: '127.0.0.1',
	port: 54322,
	user: 'postgres',
	password: 'postgres',
	database: 'postgres'
})

describe('Anonymous Authentication', () => {
	beforeAll(async () => {
		await dbClient.connect()
	})

	afterAll(async () => {
		await dbClient.end()
	})

	describe('User Creation', () => {
		it('should create a new anonymous user', async () => {
			const deviceId = `test_auth_${Date.now()}_${Math.random()}`

			const { data, error } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			expect(error).toBeNull()
			expect(data).toBeDefined()

			const user = data as AnonymousUser
			expect(user.id).toBeTruthy()
			expect(user.device_id).toBe(deviceId)
			expect(user.subway_line).toBeTruthy()
			expect(user.subway_color).toBeTruthy()
			expect(user.created_at).toBeTruthy()
		})

		it('should return existing user for same device ID', async () => {
			const deviceId = `test_existing_${Date.now()}`

			// First call - create user
			const { data: user1 } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			// Second call - should return same user
			const { data: user2 } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			expect(user1.id).toBe(user2.id)
			expect(user1.device_id).toBe(user2.device_id)
			expect(user1.subway_line).toBe(user2.subway_line)
		})

		it('should update last_seen_at on subsequent calls', async () => {
			const deviceId = `test_lastseen_${Date.now()}`

			// First call
			const { data: user1 } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 100))

			// Second call
			const { data: user2 } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			// last_seen_at should be updated
			expect(new Date(user2.last_seen_at).getTime())
				.toBeGreaterThan(new Date(user1.last_seen_at).getTime())
		})

		it('should assign valid subway line', async () => {
			const deviceId = `test_subway_${Date.now()}`
			const { data: user } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			const validLines = ['1','2','3','4','5','6','7','A','B','C','D','E','F','G','J','L','M','N','Q','R','W','Z']
			expect(validLines).toContain(user.subway_line)
		})

		it('should assign valid subway color matching the line', async () => {
			const deviceId = `test_color_${Date.now()}`
			const { data: user } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			const validColors = [
				'mta-blue', 'mta-orange', 'mta-light-green', 'mta-brown',
				'mta-grey', 'mta-yellow', 'mta-red', 'mta-dark-green', 'mta-purple'
			]
			expect(validColors).toContain(user.subway_color)
		})
	})

	describe('Anonymous Users View', () => {
		it('should expose users through anonymous_users view', async () => {
			const deviceId = `test_view_${Date.now()}`

			// Create user via RPC
			const { data: user } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			// Query via view
			const result = await dbClient.query(`
				SELECT * FROM anonymous_users WHERE device_id = $1
			`, [deviceId])

			expect(result.rows.length).toBe(1)
			expect(result.rows[0].id).toBe(user.id)
			expect(result.rows[0].subway_line).toBe(user.subway_line)
		})
	})

	describe('User Stats', () => {
		it('should initialize new users with zero karma', async () => {
			const deviceId = `test_karma_${Date.now()}`
			const { data: user } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			// Check karma in database
			const result = await dbClient.query(`
				SELECT total_karma FROM users WHERE id = $1
			`, [user.id])

			expect(result.rows[0].total_karma).toBe(0)
		})

		it('should initialize new users with zero posts/comments', async () => {
			const deviceId = `test_stats_${Date.now()}`
			const { data: user } = await (supabase as any).rpc('get_or_create_user', {
				device_id_param: deviceId
			})

			const result = await dbClient.query(`
				SELECT posts_created, comments_created FROM users WHERE id = $1
			`, [user.id])

			expect(result.rows[0].posts_created).toBe(0)
			expect(result.rows[0].comments_created).toBe(0)
		})
	})
})