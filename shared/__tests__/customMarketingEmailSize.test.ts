import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_MARKETING_SAFE_HTML_BYTES,
  GMAIL_CLIP_HTML_BYTES,
  customMarketingGmailClipWarning,
  formatByteSizeKb,
  isCustomMarketingHtmlOverGmailClip,
  utf8ByteLength
} from '../customMarketingEmailSize'

describe('customMarketingEmailSize', () => {
  it('measures utf8 byte length', () => {
    assert.equal(utf8ByteLength('abc'), 3)
    assert.ok(utf8ByteLength('é') >= 2)
  })

  it('formats KB labels', () => {
    assert.equal(formatByteSizeKb(1024), '1.0KB')
    assert.equal(formatByteSizeKb(20 * 1024), '20KB')
  })

  it('warns near and over Gmail clip threshold', () => {
    const safe = 'a'.repeat(CUSTOM_MARKETING_SAFE_HTML_BYTES - 10)
    assert.equal(customMarketingGmailClipWarning(safe), null)
    const near = 'a'.repeat(CUSTOM_MARKETING_SAFE_HTML_BYTES + 10)
    assert.match(String(customMarketingGmailClipWarning(near)), /102KB/)
    const over = 'a'.repeat(GMAIL_CLIP_HTML_BYTES + 10)
    assert.equal(isCustomMarketingHtmlOverGmailClip(over), true)
    assert.match(String(customMarketingGmailClipWarning(over)), /clips messages/)
  })
})
