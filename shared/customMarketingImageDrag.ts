/** True when the drop is a new file from outside the editor (not a node reposition). */
export function shouldAcceptExternalImageDrop(moved: boolean, event: DragEvent): boolean {
  if (moved) return false
  const files = Array.from(event.dataTransfer?.files ?? [])
  return files.some((file) => file.type.startsWith('image/'))
}

export function firstImageFileFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  const files = Array.from(dataTransfer?.files ?? [])
  return files.find((file) => file.type.startsWith('image/')) ?? null
}
