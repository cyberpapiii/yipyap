#!/usr/bin/env node
/**
 * Automated browser test to debug vote sync issue
 * Uses Playwright to simulate the exact user flow
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function runTest() {
  console.log('========================================')
  console.log('Browser Vote Sync Test')
  console.log('========================================\n')

  const browser = await chromium.launch({ headless: false }) // Show browser for debugging
  const context = await browser.newContext()
  const page = await context.newPage()

  // Collect console logs
  const consoleLogs = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[VOTE DEBUG]')) {
      consoleLogs.push(text)
      console.log(text)
    }
  })

  try {
    console.log('1. Loading home page...\n')
    await page.goto(BASE_URL)
    await page.waitForSelector('[data-testid="post-card"], .space-y-4 > div', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for feed to fully load

    // Find first post's vote button
    console.log('\n2. Finding first post...\n')

    // Get the first post card
    const postCards = await page.$$('.space-y-4 > div')
    if (postCards.length === 0) {
      console.log('No posts found!')
      return
    }

    const firstPost = postCards[0]

    // Get current vote count from the first post
    const voteCountElement = await firstPost.$('button span, [class*="vote"]')
    const initialVoteText = await voteCountElement?.textContent() || 'N/A'
    console.log(`Initial vote count display: ${initialVoteText}`)

    // Click the upvote button
    console.log('\n3. Clicking upvote button...\n')
    const upvoteButton = await firstPost.$('button:first-child')
    if (!upvoteButton) {
      console.log('Could not find upvote button')
      return
    }

    await upvoteButton.click()
    await page.waitForTimeout(1000) // Wait for optimistic update + API call

    // Get vote count after clicking
    const afterVoteText = await voteCountElement?.textContent() || 'N/A'
    console.log(`Vote count after clicking: ${afterVoteText}`)

    // Click on the post to navigate to thread
    console.log('\n4. Navigating to thread view...\n')

    // Find the post content area to click (not the buttons)
    const postContent = await firstPost.$('p, .content, [class*="content"]')
    if (postContent) {
      await postContent.click()
    } else {
      // Try clicking the post card itself
      await firstPost.click()
    }

    await page.waitForTimeout(2000) // Wait for thread to load

    // Check URL changed to thread
    const threadUrl = page.url()
    console.log(`Current URL: ${threadUrl}`)

    if (!threadUrl.includes('/thread/')) {
      console.log('Did not navigate to thread. Trying to find and click post link...')
      // Try finding a link within the post
      const postLink = await firstPost.$('a[href*="/thread/"]')
      if (postLink) {
        await postLink.click()
        await page.waitForTimeout(2000)
      }
    }

    // Get vote count in thread view
    const threadVoteElement = await page.$('button span, [class*="vote"]')
    const threadVoteText = await threadVoteElement?.textContent() || 'N/A'
    console.log(`Thread view vote count: ${threadVoteText}`)

    // Navigate back to feed
    console.log('\n5. Navigating back to feed...\n')
    await page.goBack()
    await page.waitForTimeout(3000) // Wait for afterNavigate refresh

    // Get vote count after returning
    const newPostCards = await page.$$('.space-y-4 > div')
    if (newPostCards.length > 0) {
      const newVoteElement = await newPostCards[0].$('button span, [class*="vote"]')
      const finalVoteText = await newVoteElement?.textContent() || 'N/A'
      console.log(`Feed vote count after returning: ${finalVoteText}`)
    }

    console.log('\n========================================')
    console.log('CONSOLE LOGS SUMMARY')
    console.log('========================================\n')

    consoleLogs.forEach(log => console.log(log))

    console.log('\n========================================')
    console.log('TEST COMPLETE - Check logs above')
    console.log('========================================')

    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 30 seconds for manual inspection...')
    await page.waitForTimeout(30000)

  } catch (error) {
    console.error('Test error:', error)
  } finally {
    await browser.close()
  }
}

runTest().catch(console.error)
