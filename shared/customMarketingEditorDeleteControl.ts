/** Shared editor-only delete control for photos and two-column blocks (not emailed). */
export function createCustomMarketingNodeDeleteButton(options: {
  ariaLabel: string
  title: string
  onDelete: () => void
}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'custom-marketing-editor__node-delete'
  button.setAttribute('aria-label', options.ariaLabel)
  button.title = options.title
  button.tabIndex = -1
  button.draggable = false
  button.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>'
  button.addEventListener('dragstart', (event) => event.preventDefault())
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    options.onDelete()
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  return button
}
