import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('email template approval phase 2 wiring', () => {
  it('exposes Template approval as a superadmin tenant permission', () => {
    const permissions = readFileSync(
      resolve(root, 'shared/tenantFeaturePermissions.ts'),
      'utf8'
    )
    expect(permissions).toContain("key: 'allowTenantTemplateApproval'")
    expect(permissions).toContain("code: 'email-templates:approval'")
    expect(permissions).toContain("patchPath: 'allow-tenant-template-approval'")

    const patch = readFileSync(
      resolve(
        root,
        'server/api/v1/admin/tenants/db/[dbName]/allow-tenant-template-approval.patch.ts'
      ),
      'utf8'
    )
    expect(patch).toContain('allowTenantTemplateApproval')
    expect(patch).toContain('parseAllowTenantTemplateApproval')
  })

  it('exposes approvals APIs under email-templates', () => {
    const approvals = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/approvals.get.ts'),
      'utf8'
    )
    const approve = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/[id]/approve.post.ts'),
      'utf8'
    )
    const reject = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/[id]/reject.post.ts'),
      'utf8'
    )
    expect(approvals).toContain('requireEmailTemplateApprover')
    expect(approvals).toContain('EMAIL_TEMPLATE_APPROVAL_PENDING')
    expect(approve).toContain('emailTemplateApprovalFieldsOnApprove')
    expect(reject).toContain('emailTemplateApprovalFieldsOnReject')
  })

  it('sidebar Template approvals requires Template approval flag + approver', () => {
    const nav = readFileSync(resolve(root, 'app/constants/marketingSidebarNav.ts'), 'utf8')
    expect(nav).toContain("to: '/tenant/email-templates/approvals'")
    expect(nav).toContain('requiresTenantTemplateApproval: true')
    expect(nav).toContain('requiresTemplateApprover: true')

    const layout = readFileSync(resolve(root, 'app/layouts/default.vue'), 'utf8')
    expect(layout).toContain('requiresTenantTemplateApproval')
    expect(layout).toContain('allowTenantTemplateApproval')
    expect(layout).toContain('requiresTemplateApprover')
    expect(layout).toContain('canSelectAnyLoanOfficer')
    expect(layout).toContain('usePendingEmailTemplateApprovalsCount')
    expect(layout).toContain('showApprovalsBadge')
  })

  it('templates list and editor show approval badge', () => {
    const index = readFileSync(
      resolve(root, 'app/pages/tenant/email-templates/index.vue'),
      'utf8'
    )
    const add = readFileSync(resolve(root, 'app/pages/tenant/email-templates/add.vue'), 'utf8')
    const approvalsPage = readFileSync(
      resolve(root, 'app/pages/tenant/email-templates/approvals.vue'),
      'utf8'
    )
    expect(index).toContain('TenantEmailTemplateApprovalBadge')
    expect(index).toContain('formatApprovalMeta')
    expect(index).toContain('approvalUiEnabled')
    expect(add).toContain('TenantEmailTemplateApprovalBadge')
    expect(add).toContain('approvalReviewedBy')
    expect(add).toContain('Approved by')
    expect(approvalsPage).toContain('approveEmailTemplate')
    expect(approvalsPage).toContain('rejectEmailTemplate')
    expect(approvalsPage).toContain('Make campaign')
    expect(approvalsPage).not.toContain('Send test email')
    expect(approvalsPage).not.toContain('sendTestEmailForDraft')
    expect(approvalsPage).toContain('TenantEmailTemplateThumbnail')
    expect(approvalsPage).toContain('searchQuery')
    expect(approvalsPage).toContain('allowTenantTemplateApproval')
    expect(approvalsPage).not.toContain('allowTenantLoRecipientLists')
  })

  it('email templates library excludes pending for approvers', () => {
    const listApi = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/index.get.ts'),
      'utf8'
    )
    const page = readFileSync(
      resolve(root, 'app/composables/useEmailTemplatesPage.ts'),
      'utf8'
    )
    expect(listApi).toContain('emailTemplateLibraryExcludePendingFilter')
    expect(page).toContain('EMAIL_TEMPLATE_APPROVAL_PENDING')
    expect(page).toContain('showApprovalsLink')
    expect(page).toContain('approvalUiEnabled')
    expect(page).toContain('formatApprovalMeta')
    expect(page).toContain('approvalReviewedBy')
  })
})
