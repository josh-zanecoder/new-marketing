import { describe, expect, it } from 'vitest'
import { buildCampaignBrevoBatchRequest } from './buildCampaignBrevoBatchRequest'

describe('buildCampaignBrevoBatchRequest', () => {
  it('copies per-recipient List-Unsubscribe headers onto messageVersions', () => {
    const headers = {
      'List-Unsubscribe':
        '<https://marketing.example.com/api/v1/unsubscribe/one-click?token=a>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
    const built = buildCampaignBrevoBatchRequest([
      {
        to: [{ email: 'a@example.com' }],
        subject: 'Hi',
        htmlContent: '<p>Hi</p>',
        headers
      },
      {
        to: [{ email: 'b@example.com' }],
        subject: 'Hi',
        htmlContent: '<p>Hi</p>',
        headers: {
          ...headers,
          'List-Unsubscribe':
            '<https://marketing.example.com/api/v1/unsubscribe/one-click?token=b>'
        }
      }
    ])

    expect(built.uniform).toBe(true)
    expect(built.messageVersions[0]?.headers).toEqual(headers)
    expect(built.messageVersions[1]?.headers?.['List-Unsubscribe']).toContain('token=b')
  })
})
