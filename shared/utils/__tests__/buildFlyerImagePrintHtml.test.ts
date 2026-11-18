import { describe, expect, it } from 'vitest'
import { buildFlyerImagePrintHtml } from '../buildFlyerImagePrintHtml'

describe('buildFlyerImagePrintHtml', () => {
  it('embeds the image src and suppresses page margins for print chrome', () => {
    const html = buildFlyerImagePrintHtml({
      src: '/api/v1/tenant/flyers/abc/file',
      name: 'Spring Promo'
    })

    expect(html).toContain('src="/api/v1/tenant/flyers/abc/file"')
    expect(html).toContain('alt="Spring Promo"')
    expect(html).toContain('@page { margin: 0;')
    expect(html).toContain('<title></title>')
  })

  it('escapes attribute values', () => {
    const html = buildFlyerImagePrintHtml({
      src: 'https://example.com/a"b.png',
      name: 'A <B> & C'
    })

    expect(html).toContain('src="https://example.com/a&quot;b.png"')
    expect(html).toContain('alt="A &lt;B&gt; &amp; C"')
  })
})
