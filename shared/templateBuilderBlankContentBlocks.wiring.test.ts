import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMAIL_BLOCK_OPTIONS } from './utils/emailTemplateBlocks'
import { TENANT_FEATURE_PERMISSIONS } from './tenantFeaturePermissions'

const root = resolve(__dirname, '..')

describe('Template Builder blank content blocks', () => {
  it('Template Builder always enables Add blocks (not gated by Edit text)', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/template-builder/index.vue'), 'utf8')
    expect(page).toContain(':can-upload-image="true"')
    expect(page).toContain(':can-edit-text="true"')
    expect(page).not.toContain(':can-edit-text="allowTenantEditText"')
  })

  it('EmailTemplateImageBuilder opens Add when canEditText and catalogs content + layout blocks', () => {
    const builder = readFileSync(
      resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'),
      'utf8'
    )
    expect(builder).toContain("props.canEditText ? 'add' : 'layout'")
    expect(builder).toContain("v-if=\"canEditText\"")
    expect(builder).toContain("sidePanel === 'add' && canEditText")
    expect(builder).toContain('EMAIL_BLOCK_OPTIONS')
    expect(builder).toContain('@click="addBlock(option.kind)"')
  })

  it('shared block catalog includes text, heading, button, divider, and column rows', () => {
    const kinds = EMAIL_BLOCK_OPTIONS.map((entry) => entry.kind)
    expect(kinds).toEqual(
      expect.arrayContaining([
        'title',
        'text',
        'button',
        'divider',
        'image',
        'sect100',
        'sect50'
      ])
    )
    expect(EMAIL_BLOCK_OPTIONS.some((entry) => entry.group === 'Content')).toBe(true)
    expect(EMAIL_BLOCK_OPTIONS.some((entry) => entry.group === 'Layout')).toBe(true)
  })

  it('admin copy states Template Builder includes Add blocks', () => {
    const templateBuilder = TENANT_FEATURE_PERMISSIONS.find(
      (permission) => permission.key === 'allowTenantTemplateBuilder'
    )
    expect(templateBuilder?.description).toMatch(/Add blocks/i)
    const editText = TENANT_FEATURE_PERMISSIONS.find(
      (permission) => permission.key === 'allowTenantEditText'
    )
    expect(editText?.description).toMatch(/Template Builder always includes Add blocks/i)
  })
})
