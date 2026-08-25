import { describe, expect, it } from 'vitest'
import { BREVO_WEBHOOK_CLOUD_TASK_ID_PREFIX } from '@server/constants/brevoWebhookTask'
import { brevoWebhookCloudTaskId } from '@server/utils/brevo/brevoWebhookTaskId'

describe('brevoWebhookCloudTaskId', () => {
  it('builds stable id from messageId event and date', () => {
    const id = brevoWebhookCloudTaskId({
      messageId: '<abc@smtp-relay.mailin.fr>',
      event: 'delivered',
      date: '2026-08-25T17:15:00.000Z',
      email: 'a@b.com',
      subject: '',
      from: '',
      ip: '',
      link: '',
      reason: '',
      tag: '',
      tags: [],
      templateId: null
    })
    expect(id.startsWith(BREVO_WEBHOOK_CLOUD_TASK_ID_PREFIX)).toBe(true)
    expect(id).toContain('delivered')
    expect(id.length).toBeLessThanOrEqual(500)
  })

  it('sanitizes special characters', () => {
    const id = brevoWebhookCloudTaskId({
      messageId: 'msg/with spaces',
      event: 'unique_opened',
      date: '2026-08-25T17:15:00+00:00',
      email: '',
      subject: '',
      from: '',
      ip: '',
      link: '',
      reason: '',
      tag: '',
      tags: [],
      templateId: null
    })
    expect(id).not.toContain('/')
    expect(id).not.toContain(' ')
  })
})
