import { describe, expect, it } from 'vitest'
import {
  isHostedImagePickerUploadDisabled,
  shouldShowHostedImagePickerListSkeleton
} from '../hostedImagePickerUploadGate'

describe('isHostedImagePickerUploadDisabled', () => {
  it('stays enabled while the gallery list is loading', () => {
    expect(isHostedImagePickerUploadDisabled(false)).toBe(false)
  })

  it('disables only while an upload is in flight', () => {
    expect(isHostedImagePickerUploadDisabled(true)).toBe(true)
  })
})

describe('shouldShowHostedImagePickerListSkeleton', () => {
  it('shows skeleton during first empty list fetch', () => {
    expect(shouldShowHostedImagePickerListSkeleton(true, 0)).toBe(true)
  })

  it('hides skeleton when list is idle or already has items', () => {
    expect(shouldShowHostedImagePickerListSkeleton(false, 0)).toBe(false)
    expect(shouldShowHostedImagePickerListSkeleton(true, 3)).toBe(false)
  })
})
