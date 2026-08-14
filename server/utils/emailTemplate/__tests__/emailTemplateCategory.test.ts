import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATE_CATEGORY_FILTER_ALL,
  EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED,
  EMAIL_TEMPLATE_CATEGORY_QUERY_KEY,
  EMAIL_TEMPLATES_LIST_PATH
} from '~~/shared/constants/emailTemplateCategory'
import {
  buildEmailTemplateCategoryAssignOptions,
  buildEmailTemplateCategoryFilterOptions,
  buildEmailTemplatesListHref,
  matchesEmailTemplateCategoryFilter,
  normalizeEmailTemplateCategoryName,
  parseEmailTemplateCategoryFilterQuery
} from '~~/shared/utils/emailTemplateCategory'

describe('emailTemplateCategory', () => {
  it('normalizes category names', () => {
    expect(normalizeEmailTemplateCategoryName('  Newsletter  ')).toBe('Newsletter')
    expect(normalizeEmailTemplateCategoryName('Promo   blast')).toBe('Promo blast')
    expect(normalizeEmailTemplateCategoryName('')).toBe('')
  })

  it('matches category filters', () => {
    expect(matchesEmailTemplateCategoryFilter('abc', EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)).toBe(true)
    expect(matchesEmailTemplateCategoryFilter(null, EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('', EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED)).toBe(true)
    expect(matchesEmailTemplateCategoryFilter(null, EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED)).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('abc', EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED)).toBe(false)
    expect(matchesEmailTemplateCategoryFilter('abc', 'abc')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('abc', 'xyz')).toBe(false)
  })

  it('builds filter and assign options', () => {
    const categories = [
      { id: '1', name: 'Newsletter' },
      { id: '2', name: 'Promo' }
    ]
    expect(buildEmailTemplateCategoryFilterOptions(categories)).toEqual([
      { value: EMAIL_TEMPLATE_CATEGORY_FILTER_ALL, label: 'All categories' },
      { value: EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED, label: 'Uncategorized' },
      { value: '1', label: 'Newsletter' },
      { value: '2', label: 'Promo' }
    ])
    expect(buildEmailTemplateCategoryAssignOptions(categories)).toEqual([
      { value: '', label: 'No category' },
      { value: '1', label: 'Newsletter' },
      { value: '2', label: 'Promo' }
    ])
  })

  it('parses category filter query values', () => {
    expect(parseEmailTemplateCategoryFilterQuery(undefined)).toBe(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)
    expect(parseEmailTemplateCategoryFilterQuery(['x'])).toBe(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)
    expect(parseEmailTemplateCategoryFilterQuery('')).toBe(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)
    expect(parseEmailTemplateCategoryFilterQuery('all')).toBe(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)
    expect(parseEmailTemplateCategoryFilterQuery('  ')).toBe(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)
    expect(parseEmailTemplateCategoryFilterQuery(EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED)).toBe(
      EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED
    )
    expect(parseEmailTemplateCategoryFilterQuery('abc123')).toBe('abc123')
  })

  it('builds library deep-links for a category filter', () => {
    expect(buildEmailTemplatesListHref()).toBe(EMAIL_TEMPLATES_LIST_PATH)
    expect(buildEmailTemplatesListHref(EMAIL_TEMPLATE_CATEGORY_FILTER_ALL)).toBe(EMAIL_TEMPLATES_LIST_PATH)
    expect(buildEmailTemplatesListHref('cat-1')).toBe(
      `${EMAIL_TEMPLATES_LIST_PATH}?${EMAIL_TEMPLATE_CATEGORY_QUERY_KEY}=cat-1`
    )
    expect(buildEmailTemplatesListHref(EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED)).toBe(
      `${EMAIL_TEMPLATES_LIST_PATH}?${EMAIL_TEMPLATE_CATEGORY_QUERY_KEY}=uncategorized`
    )
  })
})
