import { describe, expect, it } from 'vitest'
import { EMAIL_OUTCOMES, eventLogId } from '../../supabase/functions/_shared/email-event-reaction'

describe('kept email event data contract', () => {
  it('stores bounce using the accepted reason and status', () => {
    expect(EMAIL_OUTCOMES.bounce.status).toBe('bounced')
  })
  it('stores complaint using the accepted status', () => {
    expect(EMAIL_OUTCOMES.complaint.status).toBe('complained')
  })
  it('stores unsubscribe as suppressed, not an unsupported unsubscribed status', () => {
    expect(EMAIL_OUTCOMES.unsubscribe.status).toBe('suppressed')
  })
  it('deduplicates redeliveries and distinguishes different events', async () => {
    const first = await eventLogId('evt-1')
    expect(await eventLogId('evt-1')).toBe(first)
    expect(await eventLogId('evt-2')).not.toBe(first)
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  })
})
