export type EmailReason = 'bounce' | 'complaint' | 'unsubscribe'
export const EMAIL_OUTCOMES = {
  bounce: { status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' },
  complaint: { status: 'complained', message: 'Spam complaint — recipient marked email as spam' },
  unsubscribe: { status: 'suppressed', message: 'Recipient unsubscribed' },
} as const

// Deterministic primary key dedupes concurrent redeliveries without new tables.
export async function eventLogId(eventId: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`email-event:${eventId}`))).slice(0, 16)
  bytes[6] = (bytes[6] & 15) | 80
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
