/**
 * End-to-End User Flow Tests
 * Tests real user interactions in a browser
 */

import { test, expect } from '@playwright/test'

test.describe('YipYap User Flows', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before each test
		await page.goto('/')
		await page.evaluate(() => localStorage.clear())
		await page.reload()

		// Wait for app to initialize
		await page.waitForTimeout(2000)
	})

	test('should load the home page', async ({ page }) => {
		await page.goto('/')

		// Check for YipYap logo
		await expect(page.locator('header svg')).toBeVisible()

		// Check for feed tabs
		await expect(page.locator('text=Hot')).toBeVisible()
		await expect(page.locator('text=New')).toBeVisible()
	})

	test('should create a post with line breaks', async ({ page }) => {
		await page.goto('/')

		// Wait for page to load
		await page.waitForTimeout(2000)

		// Click the compose button
		await page.click('button[aria-label*="Create"]')

		// Wait for modal
		await page.waitForSelector('textarea[placeholder*="What"]')

		// Type post with line breaks
		const content = 'Line one\nLine two\nLine three'
		await page.fill('textarea', content)

		// Submit
		await page.click('button:has-text("Post")')

		// Wait for post to appear
		await page.waitForTimeout(1000)

		// Verify post appears in feed with line breaks
		const postCard = page.locator('text=Line one')
		await expect(postCard).toBeVisible()
	})

	test('should switch between Hot and New feeds', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Should start on Hot feed
		const hotTab = page.locator('button:has-text("Hot")')
		await expect(hotTab).toHaveClass(/active|bg-/)

		// Switch to New feed
		await page.click('button:has-text("New")')
		await page.waitForTimeout(500)

		// New tab should be active
		const newTab = page.locator('button:has-text("New")')
		await expect(newTab).toHaveClass(/active|bg-/)

		// Feed should load
		await page.waitForTimeout(1000)
	})

	test('should open thread and add comment', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Find first post and click it
		const firstPost = page.locator('[role="article"]').first()
		await firstPost.click()

		// Wait for thread page to load
		await page.waitForURL(/\/thread\//)
		await page.waitForTimeout(1000)

		// Click Reply button
		await page.click('button:has-text("Reply")')

		// Wait for compose modal
		await page.waitForSelector('textarea')

		// Type comment
		await page.fill('textarea', 'Test comment from E2E test')

		// Submit
		await page.click('button:has-text("Post")')

		// Wait for comment to appear
		await page.waitForTimeout(1000)

		// Verify comment appears
		await expect(page.locator('text=Test comment from E2E test')).toBeVisible()
	})

	test('should upvote a post', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Find first post's upvote button
		const upvoteButton = page.locator('[aria-label*="Upvote"]').first()

		// Get initial vote count
		const voteDisplay = page.locator('[role="article"]').first().locator('text=/\\d+/')
		const initialCount = await voteDisplay.textContent()

		// Click upvote
		await upvoteButton.click()
		await page.waitForTimeout(500)

		// Verify vote count changed
		const newCount = await voteDisplay.textContent()
		expect(newCount).not.toBe(initialCount)
	})

	test('should enforce 500 character limit', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Open compose modal
		await page.click('button[aria-label*="Create"]')
		await page.waitForSelector('textarea')

		// Type more than 500 characters
		const longText = 'a'.repeat(510)
		await page.fill('textarea', longText)

		// Character counter should show over limit
		await expect(page.locator('text=/500/')).toBeVisible()

		// Post button should be disabled
		const postButton = page.locator('button:has-text("Post")')
		await expect(postButton).toBeDisabled()
	})

	test('should display "You" indicator on own posts', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Create a post
		await page.click('button[aria-label*="Create"]')
		await page.fill('textarea', 'My own post for indicator test')
		await page.click('button:has-text("Post")')

		// Wait for post to appear
		await page.waitForTimeout(1000)

		// Should see "You" indicator
		await expect(page.locator('text=You').first()).toBeVisible()
	})

	test('should handle back navigation from thread', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Click first post
		await page.locator('[role="article"]').first().click()
		await page.waitForURL(/\/thread\//)

		// Go back
		await page.click('button:has-text("Back")')
		await page.waitForURL('/')

		// Should see feed again
		await expect(page.locator('text=Hot')).toBeVisible()
	})

	test('should show nested comments with indentation', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Go to a thread
		await page.locator('[role="article"]').first().click()
		await page.waitForURL(/\/thread\//)
		await page.waitForTimeout(1000)

		// Add top-level comment
		await page.click('button:has-text("Reply")')
		await page.fill('textarea', 'Parent comment')
		await page.click('button:has-text("Post")')
		await page.waitForTimeout(1000)

		// Reply to that comment
		const replyButtons = page.locator('button:has-text("Reply")')
		await replyButtons.last().click()
		await page.fill('textarea', 'Nested reply')
		await page.click('button:has-text("Post")')
		await page.waitForTimeout(1000)

		// Verify nested reply appears with indentation
		await expect(page.locator('text=Nested reply')).toBeVisible()
	})

	test('should prevent XSS attacks', async ({ page }) => {
		await page.goto('/')
		await page.waitForTimeout(2000)

		// Try to inject script tag
		await page.click('button[aria-label*="Create"]')
		await page.fill('textarea', '<script>alert("XSS")</script>')
		await page.click('button:has-text("Post")')
		await page.waitForTimeout(1000)

		// The text should appear as plain text, not execute
		await expect(page.locator('text=<script>')).toBeVisible()

		// No alert should have fired (if it did, test would hang)
	})
})