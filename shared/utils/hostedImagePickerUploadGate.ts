/**
 * Upload in the Insert/Replace image picker must stay available while the
 * Images library list is still loading. Only an in-flight upload blocks it.
 */
export function isHostedImagePickerUploadDisabled(uploadPending: boolean): boolean {
  return Boolean(uploadPending)
}

/**
 * Show the gallery skeleton only when the first list fetch has no items yet.
 * Do not use this to gate the Upload control.
 */
export function shouldShowHostedImagePickerListSkeleton(
  listPending: boolean,
  itemCount: number
): boolean {
  return Boolean(listPending) && itemCount <= 0
}
