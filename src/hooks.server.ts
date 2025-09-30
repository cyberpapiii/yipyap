import type { Handle } from '@sveltejs/kit'
import { dev } from '$app/environment'

/**
 * SvelteKit server hooks
 * Adds security headers to all responses
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)

	// Content Security Policy (CSP)
	// Prevents XSS attacks by controlling what resources can be loaded
	// In development: allow localhost connections for local Supabase
	// In production: strict HTTPS-only connections
	const connectSrc = dev
		? "'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://*.supabase.co wss://*.supabase.co"
		: "'self' https://*.supabase.co wss://*.supabase.co"

	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'", // unsafe-inline needed for SvelteKit hydration
			"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind
			"img-src 'self' data: https:", // Allow images from data URIs and HTTPS
			"font-src 'self' data:", // Allow fonts from self and data URIs
			`connect-src ${connectSrc}`, // Environment-aware: localhost in dev, HTTPS in prod
			"frame-ancestors 'none'", // Prevent clickjacking
			"base-uri 'self'", // Restrict base tag URLs
			"form-action 'self'" // Restrict form submissions
		].join('; ')
	)

	// X-Frame-Options: Prevents clickjacking attacks
	response.headers.set('X-Frame-Options', 'DENY')

	// X-Content-Type-Options: Prevents MIME-sniffing attacks
	response.headers.set('X-Content-Type-Options', 'nosniff')

	// X-XSS-Protection: Legacy XSS protection (browsers now use CSP)
	response.headers.set('X-XSS-Protection', '1; mode=block')

	// Referrer-Policy: Controls how much referrer information is sent
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

	// Permissions-Policy: Restricts browser features
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
	)

	// Strict-Transport-Security (HSTS)
	// Only enable in production with HTTPS
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
	}

	return response
}