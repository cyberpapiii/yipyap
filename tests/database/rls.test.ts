/**
 * Row Level Security (RLS) Tests
 * Verifies database permissions and security policies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const dbClient = new Client({
	host: '127.0.0.1',
	port: 54322,
	user: 'postgres',
	password: 'postgres',
	database: 'postgres'
})

describe('Database RLS Policies', () => {
	beforeAll(async () => {
		await dbClient.connect()
	})

	afterAll(async () => {
		await dbClient.end()
	})

	describe('Posts Table RLS', () => {
		it('should have RLS enabled on posts table', async () => {
			const result = await dbClient.query(`
				SELECT relname, relrowsecurity
				FROM pg_class
				WHERE relname = 'posts'
			`)

			expect(result.rows[0].relrowsecurity).toBe(true)
		})

		it('should have SELECT policy for public', async () => {
			const result = await dbClient.query(`
				SELECT COUNT(*) as count
				FROM pg_policies
				WHERE tablename = 'posts'
				AND cmd = 'SELECT'
			`)

			expect(parseInt(result.rows[0].count)).toBeGreaterThan(0)
		})

		it('should NOT have INSERT policy (writes via RPC only)', async () => {
			const result = await dbClient.query(`
				SELECT COUNT(*) as count
				FROM pg_policies
				WHERE tablename = 'posts'
				AND cmd = 'INSERT'
			`)

			expect(parseInt(result.rows[0].count)).toBe(0)
		})

		it('should prevent direct INSERT into posts table', async () => {
			// This should fail because RLS blocks direct INSERTs
			await expect(
				dbClient.query(`
					INSERT INTO posts (user_id, community, title, content)
					VALUES (gen_random_uuid(), 'dimes_square', 'test', 'test')
				`)
			).rejects.toThrow()
		})
	})

	describe('Comments Table RLS', () => {
		it('should have RLS enabled on comments table', async () => {
			const result = await dbClient.query(`
				SELECT relname, relrowsecurity
				FROM pg_class
				WHERE relname = 'comments'
			`)

			expect(result.rows[0].relrowsecurity).toBe(true)
		})

		it('should prevent direct INSERT into comments table', async () => {
			await expect(
				dbClient.query(`
					INSERT INTO comments (user_id, post_id, content)
					VALUES (gen_random_uuid(), gen_random_uuid(), 'test')
				`)
			).rejects.toThrow()
		})
	})

	describe('Votes Table RLS', () => {
		it('should have RLS enabled on votes table', async () => {
			const result = await dbClient.query(`
				SELECT relname, relrowsecurity
				FROM pg_class
				WHERE relname = 'votes'
			`)

			expect(result.rows[0].relrowsecurity).toBe(true)
		})
	})

	describe('RPC Functions Security', () => {
		it('should have SECURITY DEFINER on rpc_create_post', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_create_post'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})

		it('should have SECURITY DEFINER on rpc_create_comment', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_create_comment'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})

		it('should have SECURITY DEFINER on rpc_vote_post', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_vote_post'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})

		it('should have SECURITY DEFINER on rpc_vote_comment', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_vote_comment'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})

		it('should have SECURITY DEFINER on rpc_delete_post', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_delete_post'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})

		it('should have SECURITY DEFINER on rpc_delete_comment', async () => {
			const result = await dbClient.query(`
				SELECT proname, prosecdef
				FROM pg_proc
				WHERE proname = 'rpc_delete_comment'
			`)

			expect(result.rows[0].prosecdef).toBe(true)
		})
	})

	describe('Realtime Publication', () => {
		it('should have posts table in realtime publication', async () => {
			const result = await dbClient.query(`
				SELECT tablename
				FROM pg_publication_tables
				WHERE pubname = 'supabase_realtime'
				AND tablename = 'posts'
			`)

			expect(result.rows.length).toBe(1)
		})

		it('should have comments table in realtime publication', async () => {
			const result = await dbClient.query(`
				SELECT tablename
				FROM pg_publication_tables
				WHERE pubname = 'supabase_realtime'
				AND tablename = 'comments'
			`)

			expect(result.rows.length).toBe(1)
		})

		it('should have votes table in realtime publication', async () => {
			const result = await dbClient.query(`
				SELECT tablename
				FROM pg_publication_tables
				WHERE pubname = 'supabase_realtime'
				AND tablename = 'votes'
			`)

			expect(result.rows.length).toBe(1)
		})
	})
})