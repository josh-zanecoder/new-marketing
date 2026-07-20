import { describe, expect, it } from 'vitest'
import {
  buildEmailTemplateCategoryAssignOptions,
  buildEmailTemplateCategoryFilterOptions,
  matchesEmailTemplateCategoryFilter,
  normalizeEmailTemplateCategoryName
} from '~~/shared/utils/emailTemplateCategory'

describe('emailTemplateCategory', () => {
  it('normalizes category names', () => {
    expect(normalizeEmailTemplateCategoryName('  Newsletter  ')).toBe('Newsletter')
    expect(normalizeEmailTemplateCategoryName('Promo   blast')).toBe('Promo blast')
    expect(normalizeEmailTemplateCategoryName('')).toBe('')
  })

  it('matches category filters', () => {
    expect(matchesEmailTemplateCategoryFilter('abc', 'all')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter(null, 'all')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('', 'uncategorized')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter(null, 'uncategorized')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('abc', 'uncategorized')).toBe(false)
    expect(matchesEmailTemplateCategoryFilter('abc', 'abc')).toBe(true)
    expect(matchesEmailTemplateCategoryFilter('abc', 'xyz')).toBe(false)
  })

  it('builds filter and assign options', () => {
    const categories = [
      { id: '1', name: 'Newsletter' },
      { id: '2', name: 'Promo' }
    ]
    expect(buildEmailTemplateCategoryFilterOptions(categories)).toEqual([
      { value: 'all', label: 'All categories' },
      { value: 'uncategorized', label: 'Uncategorized' },
      { value: '1', label: 'Newsletter' },
      { value: '2', label: 'Promo' }
    ])
    expect(buildEmailTemplateCategoryAssignOptions(categories)).toEqual([
      { value: '', label: 'No category' },
      { value: '1', label: 'Newsletter' },
      { value: '2', label: 'Promo' }
    ])
  })
})
