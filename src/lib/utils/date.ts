// Simple date formatting utilities for YipYap

export function formatDistanceToNow(date: Date): string {
	const now = new Date()
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

	if (diffInSeconds < 60) {
		return 'just now'
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60)
	if (diffInMinutes < 60) {
		return `${diffInMinutes}m`
	}

	const diffInHours = Math.floor(diffInMinutes / 60)
	if (diffInHours < 24) {
		return `${diffInHours}h`
	}

	const diffInDays = Math.floor(diffInHours / 24)
	if (diffInDays < 7) {
		return `${diffInDays}d`
	}

	const diffInWeeks = Math.floor(diffInDays / 7)
	if (diffInWeeks < 4) {
		return `${diffInWeeks}w`
	}

	const diffInMonths = Math.floor(diffInDays / 30)
	if (diffInMonths < 12) {
		return `${diffInMonths}mo`
	}

	const diffInYears = Math.floor(diffInDays / 365)
	return `${diffInYears}y`
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(date)
}

export function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).format(date)
}