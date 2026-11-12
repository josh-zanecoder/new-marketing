<script setup lang="ts">
import {
  emailClientSafeImageHtml,
  emailPreviewDocument,
  emailPreviewWithBlockMarkers,
  emailTemplateHtmlImageLabel,
  type EmailImagePlacement,
  insertEmailTemplateHtmlImage,
  insertEmailTemplateHtmlImageAtPlacement,
  insertEmailTemplateHtmlImageBeforeText,
  listEmailTemplateHtmlImages,
  moveEmailTemplateHtmlImageTo,
  parseInsertableImageUrl,
  removeEmailTemplateHtmlImage,
  replaceEmailTemplateHtmlImageSrc,
  updateEmailTemplateHtmlImageLayout
} from '~~/shared/utils/emailTemplateHtmlImages'
import {
  EMAIL_TEXT_FONTS,
  EMAIL_TEXT_SIZE_MAX,
  EMAIL_TEXT_SIZE_MIN,
  emailPreviewWithArrangeMarkers,
  emailPreviewWithTextMarkers,
  listEmailArrangeItems,
  listEmailTextRuns,
  moveEmailArrangeItemTo,
  readEmailSectionBox,
  readEmailTextStyle,
  replaceEmailTextAt,
  updateEmailSectionBox,
  updateEmailTextStyle,
  type EmailSectionBoxPatch,
  type EmailTextStylePatch
} from '~~/shared/utils/emailTemplateSections'

const props = defineProps<{
  modelValue: string
  canUploadImage: boolean
  canEditText?: boolean
  canResizeImage?: boolean
  sourceHtml?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [html: string]
  'loaded-template': [{ name: string; subject: string }]
}>()

const marketingApi = useTenantMarketingApi()
const frameRef = ref<HTMLIFrameElement | null>(null)
const previewCanvasRef = ref<HTMLElement | null>(null)
const inlineEditorRef = ref<HTMLTextAreaElement | null>(null)
const textEditing = ref(false)
const inlineEditorStyle = ref<Record<string, string>>({})
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageListRef = ref<HTMLElement | null>(null)
const sectionListRef = ref<HTMLElement | null>(null)
const selectedIndex = ref<number | null>(null)
const fileMode = ref<'replace' | 'insert'>('replace')
const uploading = ref(false)
const uploadError = ref('')
const imageUrl = ref('')
const templatesOpen = ref(false)
const templatesPending = ref(false)
const templatesError = ref('')
const templates = ref<Array<{ id: string; name: string; subject: string; html: string }>>([])
const hostedImages = ref<Array<{ id: string; url: string; fileName: string }>>([])
const hostedPending = ref(false)
const hostedError = ref('')
const previewDropActive = ref(false)
const replacePickerOpen = ref(false)
const sidePanel = ref<'layout' | 'email' | 'uploads'>('layout')
const selectedPart = ref<number | null>(null)
const selectedTextIndex = ref<number | null>(null)
const linkOpen = ref(false)
const originalHtml = ref('')
let hostedDragged = false

function rememberOriginal(html: string) {
  const next = html.trim()
  if (!next || originalHtml.value) return
  originalHtml.value = html
}

watch(() => props.sourceHtml, (html) => {
  if (html) rememberOriginal(html)
}, { immediate: true })

watch(() => props.modelValue, (html) => {
  rememberOriginal(html)
}, { immediate: true })

const canResetDesign = computed(() => Boolean(originalHtml.value.trim()))
const resetConfirmOpen = ref(false)

function resetDesign() {
  if (!originalHtml.value.trim()) return
  resetConfirmOpen.value = true
}

function confirmResetDesign() {
  resetConfirmOpen.value = false
  if (!originalHtml.value.trim()) return
  selectedIndex.value = null
  imageUrl.value = ''
  replacePickerOpen.value = false
  skipNextPreviewSync = false
  if (props.modelValue !== originalHtml.value) {
    emit('update:modelValue', originalHtml.value)
    return
  }
  const frame = frameRef.value
  if (!frame) return
  const html = previewHtml(originalHtml.value)
  frame.srcdoc = ''
  frame.srcdoc = html
}

const images = computed(() => listEmailTemplateHtmlImages(props.modelValue))
const arrangeItems = computed(() => listEmailArrangeItems(props.modelValue))
const textDrafts = ref<Record<number, string>>({})

function previewHtml(html: string) {
  return emailPreviewDocument(
    emailPreviewWithTextMarkers(
      emailPreviewWithArrangeMarkers(
        emailPreviewWithBlockMarkers(emailClientSafeImageHtml(html))
      )
    )
  )
}

const previewDoc = computed(() => previewHtml(props.modelValue))
const selectedTextRuns = computed(() => {
  const item = arrangeItems.value.find((entry) => entry.part === selectedPart.value)
  if (!item || item.kind === 'image') return []
  return listEmailTextRuns(props.modelValue).filter((run) => run.start >= item.start && run.end <= item.end)
})
const sectionCards = computed(() => {
  const items = arrangeItems.value
  return items.filter((item) => {
    if (item.kind !== 'text') return true
    return !items.some((other) =>
      other.kind === 'section'
      && other.part !== item.part
      && item.start >= other.start
      && item.end <= other.end
    )
  })
})

function blockPartFor(part: number) {
  const items = arrangeItems.value
  const item = items.find((entry) => entry.part === part)
  if (!item || item.kind !== 'text') return part
  const parents = items.filter((other) =>
    other.kind === 'section'
    && other.part !== item.part
    && item.start >= other.start
    && item.end <= other.end
  )
  parents.sort((a, b) => (a.end - a.start) - (b.end - b.start))
  return parents[0]?.part ?? part
}

function visibleSectionPart(part: number): number {
  const mapped = blockPartFor(part)
  const cards = sectionCards.value
  if (cards.some((item) => item.part === mapped)) return mapped
  const item = arrangeItems.value.find((entry) => entry.part === mapped)
  if (!item) return mapped
  const containers = cards
    .filter((other) => item.start >= other.start && item.end <= other.end)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start))
  return containers[0]?.part ?? mapped
}

function selectSectionFromCanvas(part: number) {
  const visible = visibleSectionPart(part)
  selectedPart.value = visible
  sidePanel.value = 'layout'
  templatesOpen.value = false
  void nextTick(() => {
    const textRow = selectedTextIndex.value == null
      ? null
      : sectionListRef.value?.querySelector(`[data-text-run="${selectedTextIndex.value}"]`)
    const row = textRow ?? sectionListRef.value?.querySelector(`[data-section-part="${visible}"]`)
    if (row instanceof HTMLElement) row.scrollIntoView({ block: 'nearest' })
  })
}

function selectTextFromCanvas(index: number) {
  selectedTextIndex.value = index
  paintArrangeOutline()
  void nextTick(() => {
    const row = sectionListRef.value?.querySelector(`[data-text-run="${index}"]`)
    if (row instanceof HTMLElement) row.scrollIntoView({ block: 'nearest' })
  })
}

function sectionKindLabel(kind: string) {
  if (kind === 'image') return 'Photo'
  if (kind === 'text') return 'Words'
  return 'Block'
}
let skipNextPreviewSync = false
let scrollRestore: number | null = null

function previewSrc(src: string): string {
  return src.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()
}

type ResizeDir = 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w'
type ResizeLive = {
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  side: boolean
  fromLeft: boolean
  marginLeft: number
  marginRight: number
  objectPosition: string
}
type ImageGesture = {
  mode: 'move' | 'resize'
  dir?: ResizeDir
  index: number
  startX: number
  startY: number
  originX: number
  originY: number
  width: number
  height: number
  marginLeft: number
  marginRight: number
  scrollTop: number
  moved: boolean
  live?: ResizeLive
  placement?: EmailImagePlacement | null
  lastHitX?: number
  lastHitY?: number
}

const RESIZE_ORIGIN: Record<ResizeDir, string> = {
  e: 'left center',
  w: 'right center',
  se: 'left top',
  sw: 'right top',
  ne: 'left bottom',
  nw: 'right bottom'
}

let imageGesture: ImageGesture | null = null

function frameImage(doc: Document, index: number): HTMLImageElement | null {
  const ImageCtor = doc.defaultView?.HTMLImageElement
  const node = doc.querySelectorAll('img')[index]
  if (!node || !ImageCtor || !(node instanceof ImageCtor)) return null
  return node
}

function handleLayer(doc: Document): HTMLElement {
  doc.body.style.position = 'relative'
  let layer = doc.getElementById('email-builder-handles')
  if (!layer) {
    layer = doc.createElement('div')
    layer.id = 'email-builder-handles'
    layer.style.position = 'absolute'
    layer.style.inset = '0'
    layer.style.pointerEvents = 'none'
    layer.style.zIndex = '2147483646'
    doc.body.appendChild(layer)
  }
  return layer
}

function placeHandlesAt(doc: Document, x: number, y: number, width: number, height: number) {
  const layer = handleLayer(doc)
  const ready = new Map<string, HTMLElement>()
  for (const child of [...layer.children]) {
    const handle = child as HTMLElement
    const dir = handle.dataset.resizeHandle
    if (dir) ready.set(dir, handle)
    else handle.remove()
  }
  const points: Record<ResizeDir, [number, number]> = {
    nw: [x, y],
    ne: [x + width, y],
    sw: [x, y + height],
    se: [x + width, y + height],
    w: [x, y + height / 2],
    e: [x + width, y + height / 2]
  }
  for (const dir of Object.keys(points) as ResizeDir[]) {
    let handle = ready.get(dir)
    const side = dir === 'e' || dir === 'w'
    if (!handle) {
      handle = doc.createElement('div')
      handle.dataset.resizeHandle = dir
      handle.style.position = 'absolute'
      handle.style.width = side ? '8px' : '10px'
      handle.style.height = side ? '28px' : '10px'
      handle.style.marginLeft = side ? '-4px' : '-5px'
      handle.style.marginTop = side ? '-14px' : '-5px'
      handle.style.background = '#2563eb'
      handle.style.border = '1px solid #fff'
      handle.style.borderRadius = side ? '4px' : '2px'
      handle.style.pointerEvents = 'auto'
      handle.style.boxSizing = 'border-box'
      handle.style.cursor = side ? 'ew-resize' : dir === 'nw' || dir === 'se' ? 'nwse-resize' : 'nesw-resize'
      layer.appendChild(handle)
    }
    ready.delete(dir)
    const [x, y] = points[dir]
    handle.style.left = `${x}px`
    handle.style.top = `${y}px`
  }
  for (const leftover of ready.values()) leftover.remove()
}

function placeResizeHandles(doc: Document, img: HTMLImageElement) {
  if (!props.canResizeImage) {
    doc.getElementById('email-builder-handles')?.remove()
    return
  }
  const bodyRect = doc.body.getBoundingClientRect()
  const rect = img.getBoundingClientRect()
  placeHandlesAt(doc, rect.left - bodyRect.left, rect.top - bodyRect.top, rect.width, rect.height)
}

function frameScrollTop(doc: Document): number {
  return doc.defaultView?.scrollY || doc.documentElement?.scrollTop || doc.body?.scrollTop || 0
}

function keepFrameScroll(doc: Document, top: number) {
  doc.defaultView?.scrollTo(0, top)
}

function paintImageBox(
  img: HTMLImageElement,
  box: { dx?: number; dy?: number; width?: number; height?: number; marginLeft?: number; marginRight?: number; objectPosition?: string }
) {
  const doc = img.ownerDocument
  if (box.dx != null && box.dy != null) {
    img.style.setProperty('transform', `translate(${Math.round(box.dx)}px, ${Math.round(box.dy)}px)`)
  }
  if (box.marginLeft != null) {
    img.style.setProperty('margin-left', `${Math.round(box.marginLeft)}px`)
    img.style.setProperty('margin-right', `${Math.round(box.marginRight ?? 0)}px`)
  }
  if (box.width != null) {
    const width = Math.max(24, Math.round(box.width))
    img.style.setProperty('width', `${width}px`)
    img.style.setProperty('max-width', '100%')
    if (box.height != null) {
      const height = Math.max(24, Math.round(box.height))
      img.style.setProperty('height', `${height}px`)
      img.style.setProperty('object-fit', 'cover')
      if (box.objectPosition) img.style.setProperty('object-position', box.objectPosition)
    } else {
      img.style.setProperty('height', 'auto')
      img.style.setProperty('object-fit', 'fill')
    }
  }
  if (doc) placeResizeHandles(doc, img)
}

function pointInFrame(event: MouseEvent, doc: Document, anchor?: HTMLElement | null): { x: number; y: number } {
  const frame = frameRef.value
  const frameRect = frame?.getBoundingClientRect()
  const local = { x: event.clientX, y: event.clientY }
  if (!frameRect) return local
  const shifted = { x: event.clientX - frameRect.left, y: event.clientY - frameRect.top }
  const box = anchor?.getBoundingClientRect()
  if (!box || box.width < 1 || box.height < 1) {
    return event.view && event.view !== doc.defaultView ? shifted : local
  }
  const hits = (px: number, py: number, left: number, top: number) =>
    px >= left - 8 && py >= top - 8 && px <= left + box.width + 8 && py <= top + box.height + 8
  const onLocalBox = hits(local.x, local.y, box.left, box.top)
  const onPageBox = hits(local.x, local.y, frameRect.left + box.left, frameRect.top + box.top)
  if (onPageBox && !onLocalBox) return shifted
  if (onLocalBox && !onPageBox) return local
  if (onPageBox && (frameRect.top > 8 || frameRect.left > 8)) return shifted
  return local
}

function textNeedlesAt(doc: Document, x: number, y: number): string[] {
  const view = doc.defaultView as (Window & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }) | null
  let node: Node | null = null
  let offset = 0
  const withCaret = doc as Document & { caretRangeFromPoint?: (px: number, py: number) => Range | null }
  if (typeof withCaret.caretRangeFromPoint === 'function') {
    const range = withCaret.caretRangeFromPoint(x, y)
    node = range?.startContainer ?? null
    offset = range?.startOffset ?? 0
  } else if (view && typeof view.caretPositionFromPoint === 'function') {
    const position = view.caretPositionFromPoint(x, y)
    node = position?.offsetNode ?? null
    offset = position?.offset ?? 0
  }
  if (!node || node.nodeType !== 3) return []
  const text = node.textContent || ''
  const start = Math.max(0, offset - 24)
  const slice = text.slice(start, start + 64)
  const collapsed = slice.replace(/\s+/g, ' ').trim()
  return [...new Set([slice.trim(), collapsed])].filter((needle) => needle.length >= 8)
}

function slotPlacementAt(doc: Document, x: number, y: number, ignore?: HTMLImageElement | null): EmailImagePlacement | null {
  const view = doc.defaultView
  if (!view) return null
  const slots = [...doc.querySelectorAll('[data-email-slot]')].filter((node): node is HTMLElement => {
    if (!(node instanceof view.HTMLElement)) return false
    if (node.id === 'email-builder-handles' || node.closest('#email-builder-handles')) return false
    if (ignore && node === ignore) return false
    return true
  })
  const area = (node: HTMLElement) => {
    const rect = node.getBoundingClientRect()
    return Math.max(1, rect.width) * Math.max(1, rect.height)
  }
  const contains = (node: HTMLElement) => {
    const rect = node.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }
  const nearest = (nodes: HTMLElement[]) => [...nodes].sort((a, b) => {
    const ar = a.getBoundingClientRect()
    const br = b.getBoundingClientRect()
    const ad = Math.abs(y - (ar.top + ar.height / 2)) + Math.abs(x - (ar.left + ar.width / 2)) * 0.25
    const bd = Math.abs(y - (br.top + br.height / 2)) + Math.abs(x - (br.left + br.width / 2)) * 0.25
    return ad - bd
  })
  let choices = slots.filter(contains).sort((a, b) => area(a) - area(b))
  if (!choices.length) choices = nearest(slots)
  let slot = choices[0]
  if (slot && slot.getBoundingClientRect().height > 220) {
    const descendants = slots.filter((node) => node !== slot && slot?.contains(node))
    const nearer = nearest(descendants)[0]
    if (nearer) slot = nearer
  }
  if (!slot) return null
  const index = Number(slot.getAttribute('data-email-slot'))
  if (!Number.isFinite(index)) return null
  const rect = slot.getBoundingClientRect()
  const name = slot.tagName.toLowerCase()
  const upperHalf = y <= rect.top + rect.height * 0.55
  if (name === 'table') return { kind: upperHalf ? 'before-block' : 'after-block', index }
  if (!upperHalf && rect.height > 48) return { kind: 'after-block', index }
  return { kind: 'into-block', index }
}

function readDropTarget(doc: Document, x: number, y: number, ignore?: HTMLImageElement | null) {
  const handles = doc.getElementById('email-builder-handles')
  const previousImage = ignore?.style.pointerEvents ?? ''
  const previousHandles = handles?.style.pointerEvents ?? ''
  if (ignore) ignore.style.pointerEvents = 'none'
  if (handles) handles.style.pointerEvents = 'none'
  try {
    return {
      needles: textNeedlesAt(doc, x, y),
      placement: slotPlacementAt(doc, x, y, ignore)
    }
  } finally {
    if (ignore) ignore.style.pointerEvents = previousImage
    if (handles) handles.style.pointerEvents = previousHandles
  }
}

function releaseDraggedImage(img: HTMLImageElement) {
  img.style.transform = ''
  img.style.transformOrigin = ''
  img.style.willChange = ''
  img.style.position = ''
  img.style.left = ''
  img.style.top = ''
  img.style.zIndex = ''
  img.style.pointerEvents = ''
}

function resizeLive(gesture: ImageGesture, dx: number, _dy: number): ResizeLive {
  const dir = gesture.dir || 'se'
  const fromLeft = dir === 'w' || dir === 'nw' || dir === 'sw'
  const fromRight = dir === 'e' || dir === 'ne' || dir === 'se'
  const fromTop = dir === 'nw' || dir === 'ne'
  const side = dir === 'e' || dir === 'w'
  let width = gesture.width
  if (fromLeft) width = Math.max(24, gesture.width - dx)
  else if (fromRight) width = Math.max(24, gesture.width + dx)
  const height = side ? gesture.height : Math.max(24, gesture.height * (width / Math.max(gesture.width, 1)))
  return {
    x: fromLeft ? gesture.originX + gesture.width - width : gesture.originX,
    y: fromTop ? gesture.originY + gesture.height - height : gesture.originY,
    width,
    height,
    scaleX: width / Math.max(gesture.width, 1),
    scaleY: height / Math.max(gesture.height, 1),
    side,
    fromLeft,
    marginLeft: fromLeft ? gesture.marginLeft + (gesture.width - width) : gesture.marginLeft,
    marginRight: gesture.marginRight,
    objectPosition: fromLeft ? 'right center' : 'left center'
  }
}

function showDropLine(doc: Document, placement: EmailImagePlacement | null | undefined) {
  let line = doc.getElementById('email-builder-drop-line')
  const view = doc.defaultView
  const slot = !placement || !view
    ? null
    : placement.kind === 'before-image'
      ? doc.querySelectorAll('img')[placement.index]
      : doc.querySelector(`[data-email-slot="${placement.index}"]`)
  if (!slot || !(slot instanceof view!.HTMLElement) || !placement) {
    line?.remove()
    return
  }
  if (!line) {
    line = doc.createElement('div')
    line.id = 'email-builder-drop-line'
    line.style.position = 'absolute'
    line.style.height = '3px'
    line.style.marginTop = '-1px'
    line.style.background = '#2563eb'
    line.style.borderRadius = '2px'
    line.style.pointerEvents = 'none'
    line.style.zIndex = '2147483645'
    doc.body.appendChild(line)
  }
  const body = doc.body.getBoundingClientRect()
  const rect = slot.getBoundingClientRect()
  const after = placement.kind === 'after-block'
  line.style.top = `${(after ? rect.bottom : rect.top) - body.top}px`
  line.style.left = `${rect.left - body.left}px`
  line.style.width = `${Math.max(rect.width, 24)}px`
}

let gestureFrame = 0
let pendingGesturePoint: { x: number; y: number } | null = null

function pointerInFrame(event: PointerEvent): { x: number; y: number } | null {
  const doc = frameRef.value?.contentDocument
  const view = doc?.defaultView
  if (view && event.view === view) return { x: event.clientX, y: event.clientY }
  const rect = frameRef.value?.getBoundingClientRect()
  if (!rect) return null
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

type DragStyle = {
  transform: string
  willChange: string
  zIndex: string
  position: string
  pointerEvents: string
  opacity: string
}

type SectionGesture = {
  part: number
  group: string
  el: HTMLElement
  startX: number
  startY: number
  scrollTop: number
  moved: boolean
  styled: boolean
  priorStyle: DragStyle
  targetPart: number | null
  place: 'before' | 'after'
}

let sectionGesture: SectionGesture | null = null
let sectionResize: {
  part: number
  edge: 'n' | 's' | 'e' | 'w'
  startX: number
  startY: number
  startPadding: number
  paddingTop: number
  paddingBottom: number
  startWidth: number
  width: number
  startMargin: number
  marginLeft: number
  maxWidth: number
  targets: HTMLElement[]
  widthEl: HTMLElement
  textFrame: HTMLElement | null
  minWord: number
  scrollTop: number
  moved: boolean
} | null = null
let pendingTextEdit: { el: HTMLElement, index: number } | null = null
let textEditReady = false
let previewHeld = false
let openingTextEdit = false
let ignoreTextBlur = false
let pendingTextBlur = 0
let resumeTextEdit: { text: string, nth: number } | null = null
let textPress: {
  el: HTMLElement
  index: number
  sectionEl: HTMLElement | null
  part: number | null
  group: string
  startX: number
  startY: number
} | null = null
let activeTextEdit: {
  el: HTMLElement
  index: number
  previousColor: string
  original: string
  textColor: string
  minWidth: number
  boxHeight: number
  singleLine: boolean
} | null = null
let editorScrollTarget: Window | null = null
const EMPTY_TEXT_MARK = '\u200c'
let textFieldAnchor: { index: number, start: number, end: number } | null = null

function textElementFromTarget(target: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = target
  while (node) {
    if (node.hasAttribute('data-email-text')) return node
    node = node.parentElement
  }
  return null
}

function detachTextEdit(el: HTMLElement, previousColor: string) {
  unbindEditorScroll()
  clearEditBreaks(el)
  el.removeAttribute('data-email-editing')
  el.style.color = previousColor
  el.style.outline = ''
  el.style.outlineOffset = ''
}

function clearEditBreaks(el: HTMLElement) {
  const view = el.ownerDocument.defaultView
  let next = el.nextElementSibling
  while (view && next instanceof view.HTMLElement && next.hasAttribute('data-email-break')) {
    const drop = next
    next = next.nextElementSibling
    drop.remove()
  }
}

function paintEditLines(el: HTMLElement, text: string) {
  const doc = el.ownerDocument
  const view = doc.defaultView
  if (!view) return
  clearEditBreaks(el)
  const lines = text.split('\n')
  el.textContent = lines[0] ?? ''
  const style = view.getComputedStyle(el)
  let after: Node = el
  for (let index = 1; index < lines.length; index += 1) {
    const br = doc.createElement('br')
    br.setAttribute('data-email-break', '')
    const span = doc.createElement('span')
    span.setAttribute('data-email-break', '')
    span.setAttribute('data-email-editing', '')
    span.style.fontSize = style.fontSize
    span.style.fontWeight = style.fontWeight
    span.style.fontFamily = style.fontFamily
    span.style.fontStyle = style.fontStyle
    span.style.lineHeight = style.lineHeight
    span.style.letterSpacing = style.letterSpacing
    span.style.color = 'transparent'
    span.textContent = lines[index] ? lines[index] : '\u00a0'
    after.parentNode?.insertBefore(br, after.nextSibling)
    br.parentNode?.insertBefore(span, br.nextSibling)
    after = span
  }
}

function editLineNodes(el: HTMLElement): HTMLElement[] {
  const view = el.ownerDocument.defaultView
  const nodes = [el]
  let next = el.nextElementSibling
  while (view && next instanceof view.HTMLElement && next.hasAttribute('data-email-break')) {
    if (next.tagName !== 'BR') nodes.push(next)
    next = next.nextElementSibling
  }
  return nodes
}

function clearEditingMarks() {
  const doc = frameRef.value?.contentDocument
  doc?.querySelectorAll('[data-email-editing]').forEach((node) => {
    node.removeAttribute('data-email-editing')
  })
}

function paintedTextColor(el: HTMLElement) {
  const view = el.ownerDocument.defaultView
  if (!view) return '#111111'
  const nested = el.querySelectorAll('*')
  const source = nested.length ? nested[nested.length - 1] : el
  if (!(source instanceof view.Element)) return '#111111'
  const color = view.getComputedStyle(source).color
  return color && color !== 'transparent' ? color : '#111111'
}

function textPaintWidth(el: HTMLElement, text: string) {
  const view = el.ownerDocument.defaultView
  const style = view?.getComputedStyle(el)
  if (!style) return 0
  const canvas = el.ownerDocument.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0
  context.font = style.font
  const letter = Number.parseFloat(style.letterSpacing)
  const spacing = Number.isFinite(letter) ? letter * Math.max(text.length - 1, 0) : 0
  return context.measureText(text).width + spacing
}

function trimEmailEdit(value: string): string {
  return value.replace(/^[ \t\u00a0]+/, '').replace(/[ \t\u00a0]+$/, '')
}

function writeRunText(html: string, index: number, nextText: string, trimEdges: boolean) {
  const run = listEmailTextRuns(html)[index]
  if (!run) return null
  const visible = nextText.replaceAll(EMPTY_TEXT_MARK, '')
  const stored = trimEdges ? trimEmailEdit(visible) : (visible.trim() ? nextText : EMPTY_TEXT_MARK)
  return replaceEmailTextAt(html, run.start, run.end, stored, false)
}

function rectInFrame(el: HTMLElement) {
  const frame = frameRef.value
  const view = el.ownerDocument.defaultView
  const rect = el.getBoundingClientRect()
  if (!frame || !view) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  const root = el.ownerDocument.documentElement.getBoundingClientRect()
  const viewportLeft = root.left + (view.scrollX || 0)
  const viewportTop = root.top + (view.scrollY || 0)
  return {
    left: rect.left - viewportLeft,
    top: rect.top - viewportTop,
    width: rect.width,
    height: rect.height
  }
}

function unionBoxInCanvas(el: HTMLElement) {
  const boxes = editLineNodes(el).map(elementBoxInCanvas).filter((box): box is NonNullable<ReturnType<typeof elementBoxInCanvas>> => box != null)
  if (!boxes.length) return elementBoxInCanvas(el)
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return {
    left,
    top,
    width: Math.max(right - left, 24),
    height: Math.max(bottom - top, 24)
  }
}

function elementBoxInCanvas(el: HTMLElement) {
  const frame = frameRef.value
  const canvas = previewCanvasRef.value
  if (!frame || !canvas) return null
  const frameRect = frame.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  const local = rectInFrame(el)
  return {
    left: frameRect.left + local.left - canvasRect.left,
    top: frameRect.top + local.top - canvasRect.top,
    width: Math.max(local.width, 24),
    height: Math.max(local.height, 24)
  }
}

function syncInlineEditorLook(el: HTMLElement) {
  const box = unionBoxInCanvas(el)
  const view = el.ownerDocument.defaultView
  const style = view?.getComputedStyle(el)
  if (!box) return
  const editing = activeTextEdit?.el === el ? activeTextEdit : null
  const textColor = editing?.textColor
    || (style?.color && style.color !== 'transparent' ? style.color : '#111111')
  const padX = (Number.parseFloat(style?.paddingLeft || '0') || 0) + (Number.parseFloat(style?.paddingRight || '0') || 0)
  const typed = editing ? (inlineEditorRef.value?.value || editing.original) : ''
  const lines = typed.split('\n')
  const widest = lines.reduce((max, line) => Math.max(max, textPaintWidth(el, line)), 0)
  const natural = editing ? Math.ceil(widest + padX + 8) : 0
  const wrap = Boolean(editing && !editing.singleLine)
  let left = box.left
  let width = Math.max(box.width, editing?.minWidth ?? 0, wrap ? 0 : natural)
  const lineCount = Math.max(1, lines.length)
  const linePx = editing?.boxHeight ?? box.height
  let height = Math.max(lineCount === 1 ? linePx : Math.ceil(linePx * lineCount), box.height)
  const textAlign = style?.textAlign || 'left'
  // A tight box around one word makes the textarea grow a scrollbar and clip the letters.
  if (editing && !wrap && width <= natural + 16) {
    const extra = 32
    width += extra
    if (textAlign === 'center') left -= extra / 2
    else if (textAlign === 'right' || textAlign === 'end') left -= extra
    height += 14
  }
  inlineEditorStyle.value = {
    left: `${left}px`,
    top: `${box.top}px`,
    width: `${width}px`,
    height: `${height}px`,
    minHeight: `${height}px`,
    color: textColor,
    caretColor: textColor,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    whiteSpace: wrap ? 'pre-wrap' : 'pre',
    overflowWrap: wrap ? 'break-word' : 'normal',
    fontFamily: style?.fontFamily || 'Arial, Helvetica, sans-serif',
    fontSize: style?.fontSize || '16px',
    fontWeight: style?.fontWeight || '400',
    fontStyle: style?.fontStyle || 'normal',
    lineHeight: style?.lineHeight || 'normal',
    letterSpacing: style?.letterSpacing || 'normal',
    textAlign,
    paddingTop: style?.paddingTop || '0px',
    paddingRight: style?.paddingRight || '0px',
    paddingBottom: style?.paddingBottom || '0px',
    paddingLeft: style?.paddingLeft || '0px'
  }
}

function repositionInlineEditor() {
  const active = activeTextEdit
  if (!active?.el.isConnected) {
    commitActiveTextEdit()
    return
  }
  syncInlineEditorLook(active.el)
  growInlineEditor()
  const doc = active.el.ownerDocument
  if (doc) placeSectionResizeHandle(doc)
}

function unbindEditorScroll() {
  editorScrollTarget?.removeEventListener('scroll', repositionInlineEditor, true)
  editorScrollTarget = null
}

function bindEditorScroll(el: HTMLElement) {
  unbindEditorScroll()
  const win = el.ownerDocument.defaultView
  if (!win) return
  editorScrollTarget = win
  win.addEventListener('scroll', repositionInlineEditor, true)
}

function fitInlineEditor(field: HTMLTextAreaElement) {
  const wrap = activeTextEdit != null && !activeTextEdit.singleLine
  const overflowingX = !wrap && (field.scrollWidth > field.clientWidth + 2 || field.scrollLeft > 0)
  const overflowingY = field.scrollHeight > field.clientHeight + 2 || field.scrollTop > 0
  if (!overflowingX && !overflowingY) {
    field.scrollTop = 0
    field.scrollLeft = 0
    return
  }
  const style = inlineEditorStyle.value
  let left = Number.parseFloat(style.left || '0') || 0
  let width = field.clientWidth || Number.parseFloat(style.width || '0') || 0
  let height = field.clientHeight || Number.parseFloat(style.height || '0') || 0
  const slack = 28
  if (overflowingX) {
    const next = field.scrollWidth + slack
    const grow = next - width
    const align = style.textAlign || 'left'
    if (align === 'center') left -= grow / 2
    else if (align === 'right' || align === 'end') left -= grow
    width = next
  }
  if (overflowingY) {
    height = field.scrollHeight + slack
  }
  inlineEditorStyle.value = {
    ...style,
    left: `${left}px`,
    width: `${Math.ceil(width)}px`,
    height: `${Math.ceil(height)}px`,
    minHeight: `${Math.ceil(height)}px`
  }
  field.scrollTop = 0
  field.scrollLeft = 0
}

function growInlineEditor() {
  void nextTick(() => {
    const field = inlineEditorRef.value
    if (!field || !activeTextEdit) return
    fitInlineEditor(field)
    void nextTick(() => {
      const again = inlineEditorRef.value
      if (!again || !activeTextEdit) return
      fitInlineEditor(again)
    })
  })
}

function caretIndexForClick(el: HTMLElement, text: string, event?: PointerEvent) {
  if (!event || !text) return text.length
  const view = el.ownerDocument.defaultView
  if (!view) return text.length
  const local = rectInFrame(el)
  const point = pointerInFrame(event)
  if (!point) return text.length
  const style = view.getComputedStyle(el)
  const canvas = el.ownerDocument.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return text.length
  context.font = style.font
  const padLeft = Number.parseFloat(style.paddingLeft) || 0
  const padTop = Number.parseFloat(style.paddingTop) || 0
  const padRight = Number.parseFloat(style.paddingRight) || 0
  const maxWidth = Math.max(8, local.width - padLeft - padRight)
  const lineHeight = Number.parseFloat(style.lineHeight) || (Number.parseFloat(style.fontSize) || 16) * 1.2
  const targetLine = Math.max(0, Math.floor((point.y - local.top - padTop) / lineHeight))
  const targetX = point.x - local.left - padLeft
  let line = 0
  let width = 0
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index] ?? ''
    const advance = context.measureText(ch).width
    if (width > 0 && width + advance > maxWidth) {
      line += 1
      width = 0
    }
    if (line > targetLine) return index
    if (line === targetLine && width + advance / 2 >= targetX) return index
    width += advance
  }
  return text.length
}

function onInlineEditorInput() {
  const active = activeTextEdit
  const field = inlineEditorRef.value
  if (!active || !field || !textEditReady) return
  if (field.value.includes('\n')) {
    textDrafts.value = { ...textDrafts.value, [active.index]: field.value }
    paintEditLines(active.el, field.value)
    syncInlineEditorLook(active.el)
    growInlineEditor()
    field.scrollTop = 0
    field.scrollLeft = 0
    paintArrangeOutline()
    return
  }
  clearEditBreaks(active.el)
  const written = writeRunText(props.modelValue, active.index, field.value, false)
  if (!written || written.html === props.modelValue) {
    growInlineEditor()
    return
  }
  clearTextDraft(active.index)
  emit('update:modelValue', written.html)
  growInlineEditor()
  syncInlineEditorLook(active.el)
}

function onInlineEditorBlur() {
  if (openingTextEdit || !textEditReady) return
  if (ignoreTextBlur) {
    ignoreTextBlur = false
    void nextTick(() => {
      if (activeTextEdit && textEditing.value) inlineEditorRef.value?.focus()
    })
    return
  }
  window.clearTimeout(pendingTextBlur)
  pendingTextBlur = window.setTimeout(() => {
    pendingTextBlur = 0
    commitActiveTextEdit()
  }, 0)
}

function commitActiveTextEdit(): boolean {
  window.clearTimeout(pendingTextBlur)
  pendingTextBlur = 0
  const active = activeTextEdit
  if (!active) return false
  if (openingTextEdit || !textEditReady) return false
  const field = inlineEditorRef.value
  const nextText = field?.value ?? active.original
  const run = listEmailTextRuns(props.modelValue)[active.index]
  const current = trimEmailEdit(run?.text.replaceAll(EMPTY_TEXT_MARK, '') ?? '')
  const visible = trimEmailEdit(nextText.replaceAll(EMPTY_TEXT_MARK, ''))
  const held = previewHeld
  previewHeld = false
  activeTextEdit = null
  textEditReady = false
  openingTextEdit = false
  textEditing.value = false
  detachTextEdit(active.el, active.previousColor)
  clearEditingMarks()
  paintArrangeOutline()
  let changed = false
  if (visible !== current) {
    const written = writeRunText(props.modelValue, active.index, nextText, true)
    if (written && written.html !== props.modelValue) {
      clearTextDraft(active.index)
      emit('update:modelValue', written.html)
      changed = true
    }
  }
  if (!changed && held) {
    const html = previewHtml(props.modelValue)
    nextTick(() => applyPreview(html))
  }
  return changed || held
}

function onInlineEditorEnter(event: KeyboardEvent) {
  if (event.shiftKey) {
    void nextTick(() => {
      const field = inlineEditorRef.value
      const active = activeTextEdit
      if (!field || !active) return
      syncInlineEditorLook(active.el)
      growInlineEditor()
      field.scrollTop = 0
    })
    return
  }
  event.preventDefault()
  commitActiveTextEdit()
}

function cancelInlineEditor() {
  window.clearTimeout(pendingTextBlur)
  pendingTextBlur = 0
  const active = activeTextEdit
  const field = inlineEditorRef.value
  if (!active || !field) return
  field.value = active.original
  onInlineEditorInput()
  commitActiveTextEdit()
}

function textRunOccurrence(index: number): { text: string, nth: number } | null {
  const runs = listEmailTextRuns(props.modelValue)
  const run = runs[index]
  if (!run) return null
  let nth = 0
  for (let i = 0; i < index; i += 1) {
    if (runs[i]?.text === run.text) nth += 1
  }
  return { text: run.text, nth }
}

function findTextRunElement(doc: Document, text: string, nth: number): HTMLElement | null {
  const view = doc.defaultView
  if (!view) return null
  let seen = 0
  for (const node of doc.querySelectorAll('[data-email-text]')) {
    if (!(node instanceof view.HTMLElement)) continue
    const value = (node.textContent || '').replace(/\u00a0/g, ' ').trim()
    if (value !== text) continue
    if (seen === nth) return node
    seen += 1
  }
  return null
}

function beginTextEdit(el: HTMLElement, index: number, event?: PointerEvent) {
  if (!props.canEditText) return
  if (activeTextEdit?.el === el && (textEditReady || openingTextEdit)) return
  const resume = textRunOccurrence(index)
  if (activeTextEdit && !textEditReady) {
    const previous = activeTextEdit
    activeTextEdit = null
    textEditing.value = false
    openingTextEdit = false
    detachTextEdit(previous.el, previous.previousColor)
    clearEditingMarks()
  } else if (commitActiveTextEdit()) {
    resumeTextEdit = resume
    return
  }
  openTextEditor(el, index, event)
}

function openTextEditor(el: HTMLElement, index: number, event?: PointerEvent) {
  if (!el.isConnected) return
  const run = listEmailTextRuns(props.modelValue)[index]
  if (!run) return
  const original = run.text.replaceAll(EMPTY_TEXT_MARK, '')
  const view = el.ownerDocument.defaultView
  const computed = view?.getComputedStyle(el)
  const fontSize = Number.parseFloat(computed?.fontSize || '16') || 16
  const lineHeight = Number.parseFloat(computed?.lineHeight || '') || fontSize * 1.2
  const box = elementBoxInCanvas(el)
  const singleLine = computed?.whiteSpace === 'nowrap'
    || computed?.whiteSpace === 'pre'
    || !box
    || box.height <= lineHeight * 1.35
  const fieldNow = inlineEditorRef.value
  if (fieldNow) fieldNow.value = original
  openingTextEdit = true
  textEditReady = false
  activeTextEdit = {
    el,
    index,
    previousColor: el.style.color,
    original,
    textColor: paintedTextColor(el),
    minWidth: singleLine
      ? Math.max(box?.width ?? 24, Math.ceil(textPaintWidth(el, original) + 8))
      : Math.max(24, box?.width ?? 24),
    boxHeight: box?.height ?? lineHeight,
    singleLine
  }
  textEditing.value = true
  syncInlineEditorLook(el)
  bindEditorScroll(el)
  const editDoc = el.ownerDocument
  if (editDoc) placeSectionResizeHandle(editDoc)
  const caret = caretIndexForClick(el, original, event)
  void nextTick(() => {
    const field = inlineEditorRef.value
    if (!field || activeTextEdit?.el !== el) {
      el.removeAttribute('data-email-editing')
      if (activeTextEdit?.el === el) {
        activeTextEdit = null
        textEditing.value = false
        textEditReady = false
      }
      openingTextEdit = false
      clearEditingMarks()
      return
    }
    field.value = original
    el.setAttribute('data-email-editing', '')
    textEditReady = true
    field.focus()
    field.setSelectionRange(caret, caret)
    growInlineEditor()
    if (editDoc) placeSectionResizeHandle(editDoc)
    openingTextEdit = false
  })
}

function textRunStyle(index: number) {
  return readEmailTextStyle(props.modelValue, index)
}

function paintPreviewTextStyle(el: HTMLElement, patch: EmailTextStylePatch) {
  if (patch.color) el.style.color = patch.color
  else if (patch.color === '' || patch.color === null) el.style.removeProperty('color')
  if (patch.size) el.style.fontSize = `${patch.size}px`
  else if (patch.size === null) el.style.removeProperty('font-size')
  if (patch.bold === true) el.style.fontWeight = '700'
  else if (patch.bold === false) el.style.fontWeight = '400'
  if (patch.italic === true) el.style.fontStyle = 'italic'
  else if (patch.italic === false) el.style.fontStyle = 'normal'
  if (patch.font) {
    const font = EMAIL_TEXT_FONTS.find((entry) => entry.id === patch.font)
    if (font) el.style.fontFamily = font.stack
  } else if (patch.font === '') el.style.removeProperty('font-family')
}

function applyRunStyle(index: number, patch: EmailTextStylePatch) {
  if (!props.canEditText) return
  let html = props.modelValue
  if (activeTextEdit?.index === index) {
    const written = writeRunText(html, index, inlineEditorRef.value?.value ?? '', false)
    if (written) html = written.html
  }
  const next = updateEmailTextStyle(html, index, patch)
  if (next === html && next === props.modelValue) return
  if (textFieldAnchor?.index === index) textFieldAnchor = null
  clearTextDraft(index)
  const doc = frameRef.value?.contentDocument
  const node = doc?.querySelector(`[data-email-text="${index}"]`)
  const view = doc?.defaultView
  if (node && view && node instanceof view.HTMLElement) {
    paintPreviewTextStyle(node, patch)
    if (activeTextEdit?.index === index) syncInlineEditorLook(node)
    skipNextPreviewSync = true
  }
  emit('update:modelValue', next)
}

function onTextFont(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value && !EMAIL_TEXT_FONTS.some((font) => font.id === value)) return
  applyRunStyle(index, { font: value as EmailTextStylePatch['font'] })
}

function onTextSize(index: number, event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  if (!value) {
    applyRunStyle(index, { size: null })
    return
  }
  const size = Number(value)
  if (!Number.isInteger(size) || size < EMAIL_TEXT_SIZE_MIN || size > EMAIL_TEXT_SIZE_MAX) return
  applyRunStyle(index, { size })
}

function finishTextSize(event: KeyboardEvent) {
  const field = event.target
  if (field instanceof HTMLInputElement) field.blur()
}

function onTextColor(index: number, event: Event) {
  const value = (event.target as HTMLInputElement).value
  applyRunStyle(index, { color: value })
}

function toggleTextBold(index: number) {
  applyRunStyle(index, { bold: !textRunStyle(index).bold })
}

function toggleTextItalic(index: number) {
  applyRunStyle(index, { italic: !textRunStyle(index).italic })
}

function textFieldValue(index: number, text: string) {
  const draft = textDrafts.value[index]
  return (draft == null ? text : draft).replaceAll(EMPTY_TEXT_MARK, '')
}

function onTextFieldFocus(index: number) {
  const run = listEmailTextRuns(props.modelValue)[index]
  if (!run) return
  textFieldAnchor = { index, start: run.start, end: run.end }
}

function onTextDraft(index: number, event: Event) {
  if (!props.canEditText) return
  const value = (event.target as HTMLTextAreaElement).value
  textDrafts.value = { ...textDrafts.value, [index]: value }
  if (textFieldAnchor?.index !== index) return
  const written = writeRunText(props.modelValue, index, value, false)
  if (!written || written.html === props.modelValue) return
  const run = listEmailTextRuns(written.html)[index]
  textFieldAnchor = run ? { index, start: run.start, end: run.end } : null
  const node = frameRef.value?.contentDocument?.querySelector(`[data-email-text="${index}"]`)
  if (node && node !== activeTextEdit?.el) {
    skipNextPreviewSync = true
    emit('update:modelValue', written.html)
    node.textContent = value
    return
  }
  emit('update:modelValue', written.html)
}

function clearTextDraft(index: number) {
  textDrafts.value = Object.fromEntries(
    Object.entries(textDrafts.value).filter(([key]) => Number(key) !== index)
  )
}

function commitTextField(index: number) {
  if (!props.canEditText) return
  const draft = textDrafts.value[index]
  const editing = textFieldAnchor?.index === index
  textFieldAnchor = null
  clearTextDraft(index)
  if (draft == null || !editing) return
  const written = writeRunText(props.modelValue, index, draft, true)
  if (!written || written.html === props.modelValue) return
  emit('update:modelValue', written.html)
}

function sectionElementFromTarget(target: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = target
  while (node) {
    if (node.getAttribute('data-email-kind') === 'section') return node
    node = node.parentElement
  }
  return null
}

function showElementDropLine(doc: Document, el: HTMLElement, after: boolean) {
  let line = doc.getElementById('email-builder-drop-line')
  if (!line) {
    line = doc.createElement('div')
    line.id = 'email-builder-drop-line'
    line.style.position = 'absolute'
    line.style.height = '3px'
    line.style.background = '#2563eb'
    line.style.borderRadius = '2px'
    line.style.pointerEvents = 'none'
    line.style.zIndex = '2147483645'
    doc.body.appendChild(line)
  }
  const body = doc.body.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  line.style.top = `${(after ? rect.bottom : rect.top) - body.top}px`
  line.style.left = `${rect.left - body.left}px`
  line.style.width = `${Math.max(rect.width, 24)}px`
}

function sectionDropAt(doc: Document, x: number, y: number, gesture: SectionGesture) {
  const view = doc.defaultView
  if (!view) return null
  const nodes = [...doc.querySelectorAll('[data-email-part]')].filter((node): node is HTMLElement => {
    return node instanceof view.HTMLElement
      && node.getAttribute('data-email-group') === gesture.group
      && node.getAttribute('data-email-part') !== String(gesture.part)
  })
  let best: HTMLElement | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    const inside = y >= rect.top && y <= rect.bottom
    const dist = inside ? 0 : Math.min(Math.abs(y - rect.top), Math.abs(y - rect.bottom))
    if (dist < bestDist) {
      bestDist = dist
      best = node
    }
  }
  if (!best || bestDist > 96) return null
  const rect = best.getBoundingClientRect()
  const part = Number(best.getAttribute('data-email-part'))
  if (!Number.isFinite(part)) return null
  return { part, place: y > rect.top + rect.height / 2 ? 'after' as const : 'before' as const, el: best }
}

function readDragStyle(el: HTMLElement): DragStyle {
  return {
    transform: el.style.transform,
    willChange: el.style.willChange,
    zIndex: el.style.zIndex,
    position: el.style.position,
    pointerEvents: el.style.pointerEvents,
    opacity: el.style.opacity
  }
}

function writeDragStyle(el: HTMLElement, style: DragStyle) {
  el.style.transform = style.transform
  el.style.willChange = style.willChange
  el.style.zIndex = style.zIndex
  el.style.position = style.position
  el.style.pointerEvents = style.pointerEvents
  el.style.opacity = style.opacity
}

function paintSectionDrag(x: number, y: number) {
  const gesture = sectionGesture
  if (!gesture) return
  const doc = gesture.el.ownerDocument
  if (!doc?.body) return
  const dx = x - gesture.startX
  const dy = y - gesture.startY
  if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true
  if (!gesture.moved) return
  if (!gesture.styled) {
    gesture.styled = true
    gesture.el.style.willChange = 'transform'
    gesture.el.style.position = 'relative'
    gesture.el.style.zIndex = '30'
    gesture.el.style.pointerEvents = 'none'
    gesture.el.style.opacity = '0.88'
  }
  if (frameScrollTop(doc) !== gesture.scrollTop) keepFrameScroll(doc, gesture.scrollTop)
  gesture.el.style.transform = `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0)`
  const hit = sectionDropAt(doc, x, y, gesture)
  gesture.targetPart = hit?.part ?? null
  gesture.place = hit?.place ?? 'before'
  if (hit) showElementDropLine(doc, hit.el, hit.place === 'after')
  else doc.getElementById('email-builder-drop-line')?.remove()
}

function finishSectionDrag(event: PointerEvent) {
  const gesture = sectionGesture
  if (!gesture) return
  stopOutsideTracking()
  if (gestureFrame) cancelAnimationFrame(gestureFrame)
  gestureFrame = 0
  const point = pointerInFrame(event)
  if (point) paintSectionDrag(point.x, point.y)
  pendingGesturePoint = null
  sectionGesture = null
  const doc = gesture.el.ownerDocument
  if (doc?.body) {
    doc.body.style.userSelect = ''
    doc.body.style.cursor = ''
  }
  doc?.getElementById('email-builder-drop-line')?.remove()
  const textEdit = !gesture.moved ? pendingTextEdit : null
  pendingTextEdit = null
  writeDragStyle(gesture.el, gesture.priorStyle)
  selectSectionFromCanvas(gesture.part)
  if (!gesture.moved || gesture.targetPart == null) {
    paintArrangeOutline()
    if (textEdit?.el.isConnected) beginTextEdit(textEdit.el, textEdit.index, event)
    return
  }
  const result = moveEmailArrangeItemTo(props.modelValue, gesture.part, gesture.targetPart, gesture.place)
  selectSectionFromCanvas(result.part)
  if (result.html !== props.modelValue) emit('update:modelValue', result.html)
  if (doc) keepFrameScroll(doc, gesture.scrollTop)
}

function beginSectionDrag(doc: Document, el: HTMLElement, part: number, group: string, event: PointerEvent) {
  const scrollTop = frameScrollTop(doc)
  try {
    doc.body.setPointerCapture(event.pointerId)
  } catch {
    /* Pointer tracking on the window covers the rest of the gesture. */
  }
  sectionGesture = {
    part,
    group,
    el,
    startX: event.clientX,
    startY: event.clientY,
    scrollTop,
    moved: false,
    styled: false,
    priorStyle: readDragStyle(el),
    targetPart: null,
    place: 'before'
  }
  doc.body.style.userSelect = 'none'
  doc.body.style.cursor = 'grabbing'
  selectSectionFromCanvas(part)
  startOutsideTracking()
  keepFrameScroll(doc, scrollTop)
}

function sectionBoxTargets(el: HTMLElement): HTMLElement[] {
  const view = el.ownerDocument.defaultView
  if (view && el.tagName === 'TR') {
    const cells = [...el.children].filter((node): node is HTMLElement =>
      node instanceof view.HTMLElement && (node.tagName === 'TD' || node.tagName === 'TH')
    )
    if (cells.length) return cells
  }
  return [el]
}

function sectionWidthElement(node: HTMLElement): HTMLElement {
  const view = node.ownerDocument.defaultView
  if (node.tagName === 'TR' && view) {
    const table = node.closest('table')
    if (table instanceof view.HTMLElement) return table
  }
  return node
}

function textFrameElement(node: HTMLElement): HTMLElement | null {
  const view = node.ownerDocument.defaultView
  if (!view) return null
  if (/^(H1|H2|H3|P|LI)$/.test(node.tagName)) return node
  const found = node.querySelector('h1, h2, h3, p, li')
  return found instanceof view.HTMLElement ? found : null
}

function longestWordPx(el: HTMLElement): number {
  const words = (el.innerText || '').split(/\s+/).filter((word) => word.length > 0)
  let max = 48
  for (const word of words) max = Math.max(max, Math.ceil(textPaintWidth(el, word) + 12))
  return max
}

function fitTextFrame(frame: HTMLElement, width: number) {
  const view = frame.ownerDocument.defaultView
  frame.style.display = 'block'
  frame.style.width = `${width}px`
  frame.style.maxWidth = `${width}px`
  frame.style.height = 'auto'
  frame.style.maxHeight = 'none'
  frame.style.wordBreak = 'normal'
  frame.style.overflowWrap = 'normal'
  if (!view) return
  frame.querySelectorAll('span, strong').forEach((node) => {
    if (node instanceof view.HTMLElement) node.style.wordBreak = 'normal'
  })
}

function resizeBoxRect(node: HTMLElement): DOMRect {
  const frame = textFrameElement(node) ?? node
  const rects = [...frame.getClientRects()].filter((rect) => rect.width > 0 || rect.height > 0)
  if (!rects.length) return frame.getBoundingClientRect()
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

function sectionResizeLayer(doc: Document): HTMLElement {
  let layer = doc.getElementById('email-builder-section-resize')
  if (layer?.dataset.ready === '2') return layer
  layer?.remove()
  layer = doc.createElement('div')
  layer.id = 'email-builder-section-resize'
  layer.dataset.ready = '2'
  layer.style.position = 'absolute'
  layer.style.inset = '0'
  layer.style.pointerEvents = 'none'
  layer.style.zIndex = '2147483646'
  for (const edge of ['n', 's', 'e', 'w'] as const) {
    const handle = doc.createElement('div')
    handle.dataset.sectionResize = edge
    handle.style.position = 'absolute'
    handle.style.pointerEvents = 'auto'
    handle.style.touchAction = 'none'
    handle.style.cursor = edge === 'n' || edge === 's' ? 'ns-resize' : 'ew-resize'
    const line = doc.createElement('div')
    line.dataset.sectionResize = edge
    line.style.position = 'absolute'
    line.style.background = '#2563eb'
    line.style.pointerEvents = 'none'
    const grip = doc.createElement('div')
    grip.dataset.sectionResize = edge
    grip.style.position = 'absolute'
    grip.style.background = '#2563eb'
    grip.style.border = '1px solid #fff'
    grip.style.borderRadius = '4px'
    grip.style.boxSizing = 'border-box'
    grip.style.pointerEvents = 'auto'
    if (edge === 'n' || edge === 's') {
      handle.style.height = '16px'
      handle.style.marginTop = '-8px'
      line.style.left = '0'
      line.style.right = '0'
      line.style.top = '50%'
      line.style.height = '2px'
      line.style.marginTop = '-1px'
      grip.style.left = '50%'
      grip.style.top = '50%'
      grip.style.width = '56px'
      grip.style.height = '8px'
      grip.style.marginLeft = '-28px'
      grip.style.marginTop = '-4px'
    } else {
      handle.style.width = '16px'
      handle.style.marginLeft = '-8px'
      line.style.top = '0'
      line.style.bottom = '0'
      line.style.left = '50%'
      line.style.width = '2px'
      line.style.marginLeft = '-1px'
      grip.style.left = '50%'
      grip.style.top = '50%'
      grip.style.width = '8px'
      grip.style.height = '36px'
      grip.style.marginLeft = '-4px'
      grip.style.marginTop = '-18px'
    }
    handle.appendChild(line)
    handle.appendChild(grip)
    layer.appendChild(handle)
  }
  doc.body.appendChild(layer)
  return layer
}

function isHiddenEmailNode(node: HTMLElement): boolean {
  const view = node.ownerDocument.defaultView
  if (!view) return false
  let current: HTMLElement | null = node
  while (current && current !== node.ownerDocument.body) {
    if (view.getComputedStyle(current).display === 'none') return true
    current = current.parentElement
  }
  return false
}

function selectedResizeElement(doc: Document): HTMLElement | null {
  const view = doc.defaultView
  if (!view) return null
  const partFrom = (start: Element | null): HTMLElement | null => {
    const part = start?.closest('[data-email-part]')
    if (!(part instanceof view.HTMLElement)) return null
    if (part.getAttribute('data-email-kind') === 'image') return null
    if (isHiddenEmailNode(part)) return null
    return part
  }
  if (selectedTextIndex.value != null) {
    for (const textNode of doc.querySelectorAll(`[data-email-text="${selectedTextIndex.value}"]`)) {
      const part = partFrom(textNode)
      if (part) return part
    }
  }
  for (const node of doc.querySelectorAll(`[data-email-part="${selectedPart.value}"]`)) {
    const part = partFrom(node)
    if (part) return part
  }
  return null
}

function contentRect(node: HTMLElement) {
  const view = node.ownerDocument.defaultView
  const own = node.getBoundingClientRect()
  if (!view) return own
  const lines = [...node.querySelectorAll('[data-email-text], [data-email-break]')].filter((entry): entry is HTMLElement => {
    return entry instanceof view.HTMLElement && entry.tagName !== 'BR'
  })
  if (!lines.length) return own
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const line of lines) {
    const rect = line.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }
  if (!Number.isFinite(left)) return own
  const padX = 12
  const padY = 4
  return new DOMRect(left - padX, top - padY, right - left + padX * 2, bottom - top + padY * 2)
}

function onParentResizeDown(event: PointerEvent) {
  const edge = (event.currentTarget as HTMLElement | null)?.dataset.sectionResize
  const doc = frameRef.value?.contentDocument
  if (!doc || (edge !== 'n' && edge !== 's' && edge !== 'e' && edge !== 'w')) return
  window.clearTimeout(pendingTextBlur)
  pendingTextBlur = 0
  event.preventDefault()
  event.stopPropagation()
  beginSectionResize(doc, event, edge)
}

function placeParentResizeHandles(node: HTMLElement | null) {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  let layer = canvas.querySelector<HTMLElement>('#email-builder-parent-resize')
  if (!textEditing.value || !node) {
    layer?.remove()
    return
  }
  const box = elementBoxInCanvas(node)
  if (!box) {
    layer?.remove()
    return
  }
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'email-builder-parent-resize'
    layer.style.position = 'absolute'
    layer.style.inset = '0'
    layer.style.pointerEvents = 'none'
    layer.style.zIndex = '30'
    for (const edge of ['n', 's', 'e', 'w'] as const) {
      const handle = document.createElement('div')
      handle.dataset.sectionResize = edge
      handle.style.position = 'absolute'
      handle.style.pointerEvents = 'auto'
      handle.style.touchAction = 'none'
      handle.style.cursor = edge === 'n' || edge === 's' ? 'ns-resize' : 'ew-resize'
      const line = document.createElement('div')
      line.style.position = 'absolute'
      line.style.background = '#2563eb'
      line.style.pointerEvents = 'none'
      const grip = document.createElement('div')
      grip.style.position = 'absolute'
      grip.style.background = '#2563eb'
      grip.style.border = '1px solid #fff'
      grip.style.borderRadius = '4px'
      grip.style.boxSizing = 'border-box'
      grip.style.pointerEvents = 'none'
      if (edge === 'n' || edge === 's') {
        handle.style.height = '16px'
        handle.style.marginTop = '-8px'
        line.style.left = '0'
        line.style.right = '0'
        line.style.top = '50%'
        line.style.height = '2px'
        line.style.marginTop = '-1px'
        grip.style.left = '50%'
        grip.style.top = '50%'
        grip.style.width = '56px'
        grip.style.height = '8px'
        grip.style.marginLeft = '-28px'
        grip.style.marginTop = '-4px'
      } else {
        handle.style.width = '16px'
        handle.style.marginLeft = '-8px'
        line.style.top = '0'
        line.style.bottom = '0'
        line.style.left = '50%'
        line.style.width = '2px'
        line.style.marginLeft = '-1px'
        grip.style.left = '50%'
        grip.style.top = '50%'
        grip.style.width = '8px'
        grip.style.height = '36px'
        grip.style.marginLeft = '-4px'
        grip.style.marginTop = '-18px'
      }
      handle.appendChild(line)
      handle.appendChild(grip)
      handle.addEventListener('pointerdown', onParentResizeDown)
      layer.appendChild(handle)
    }
    canvas.appendChild(layer)
  }
  const handles = new Map<string, HTMLElement>()
  for (const child of layer.children) {
    if (child instanceof HTMLElement && child.dataset.sectionResize) handles.set(child.dataset.sectionResize, child)
  }
  const north = handles.get('n')
  const south = handles.get('s')
  const east = handles.get('e')
  const west = handles.get('w')
  if (north) {
    north.style.left = `${box.left}px`
    north.style.width = `${box.width}px`
    north.style.top = `${box.top}px`
  }
  if (south) {
    south.style.left = `${box.left}px`
    south.style.width = `${box.width}px`
    south.style.top = `${box.top + box.height}px`
  }
  if (east) {
    east.style.left = `${box.left + box.width}px`
    east.style.top = `${box.top}px`
    east.style.height = `${box.height}px`
  }
  if (west) {
    west.style.left = `${box.left}px`
    west.style.top = `${box.top}px`
    west.style.height = `${box.height}px`
  }
}

function placeSectionResizeHandle(doc: Document) {
  const view = doc.defaultView
  const node = selectedResizeElement(doc)
  // Text boxes are edited, not resized. Handles stay off headings and paragraphs.
  if (!view || !node || textFrameElement(node)) {
    doc.getElementById('email-builder-section-resize')?.remove()
    placeParentResizeHandles(null)
    return
  }
  doc.body.style.position = 'relative'
  const bodyRect = doc.body.getBoundingClientRect()
  const rect = resizeBoxRect(node)
  const layer = sectionResizeLayer(doc)
  layer.style.visibility = textEditing.value ? 'hidden' : 'visible'
  const handles = new Map<string, HTMLElement>()
  for (const child of layer.children) {
    if (child instanceof view.HTMLElement && child.dataset.sectionResize) handles.set(child.dataset.sectionResize, child)
  }
  const north = handles.get('n')
  const south = handles.get('s')
  const east = handles.get('e')
  const west = handles.get('w')
  if (north) {
    north.style.left = `${rect.left - bodyRect.left}px`
    north.style.width = `${Math.max(rect.width, 24)}px`
    north.style.top = `${rect.top - bodyRect.top}px`
  }
  if (south) {
    south.style.left = `${rect.left - bodyRect.left}px`
    south.style.width = `${Math.max(rect.width, 24)}px`
    south.style.top = `${rect.bottom - bodyRect.top}px`
  }
  const top = rect.top - bodyRect.top
  const height = Math.max(rect.height, 24)
  if (east) {
    east.style.left = `${rect.right - bodyRect.left}px`
    east.style.top = `${top}px`
    east.style.height = `${height}px`
  }
  if (west) {
    west.style.left = `${rect.left - bodyRect.left}px`
    west.style.top = `${top}px`
    west.style.height = `${height}px`
  }
  placeParentResizeHandles(node)
}

function paintSectionPatch(part: number, patch: EmailSectionBoxPatch) {
  const doc = frameRef.value?.contentDocument
  const view = doc?.defaultView
  const node = doc?.querySelector(`[data-email-part="${part}"]`)
  if (!doc || !view || !(node instanceof view.HTMLElement)) return false
  for (const target of sectionBoxTargets(node)) {
    if (patch.background) target.style.backgroundColor = patch.background
    else if (patch.background === '' || patch.background === null) target.style.backgroundColor = ''
    if (patch.paddingBottom != null) target.style.paddingBottom = `${patch.paddingBottom}px`
    if (patch.paddingTop != null) target.style.paddingTop = `${patch.paddingTop}px`
    if (patch.paddingLeft != null) target.style.paddingLeft = `${patch.paddingLeft}px`
    if (patch.paddingRight != null) target.style.paddingRight = `${patch.paddingRight}px`
  }
  const widthNode = sectionWidthElement(node)
  if (patch.width != null) {
    widthNode.style.width = `${patch.width}px`
    if (widthNode.tagName === 'TABLE') widthNode.setAttribute('width', String(patch.width))
  } else if (patch.width === null) {
    widthNode.style.width = ''
    if (widthNode.tagName === 'TABLE') widthNode.removeAttribute('width')
  }
  if (patch.marginLeft != null) {
    widthNode.style.marginLeft = `${patch.marginLeft}px`
    widthNode.style.marginRight = '0'
    if (widthNode.tagName === 'TABLE') widthNode.setAttribute('align', 'left')
  }
  placeSectionResizeHandle(doc)
  return true
}

function applySectionBox(part: number, patch: EmailSectionBoxPatch) {
  const next = updateEmailSectionBox(props.modelValue, part, patch)
  if (next === props.modelValue) return
  if (paintSectionPatch(part, patch)) skipNextPreviewSync = true
  emit('update:modelValue', next)
}

function sectionBox(part: number) {
  return readEmailSectionBox(props.modelValue, part)
}

function onSectionBackground(part: number, event: Event) {
  applySectionBox(part, { background: (event.target as HTMLInputElement).value })
}

function clampDragWidth(value: number, maxWidth: number): number {
  const cap = Math.max(80, Math.min(1200, maxWidth))
  return Math.max(80, Math.min(cap, Math.round(value)))
}

function beginSectionResize(doc: Document, event: PointerEvent, edge: 'n' | 's' | 'e' | 'w') {
  const view = doc.defaultView
  const node = selectedResizeElement(doc)
  const part = Number(node?.getAttribute('data-email-part'))
  if (!view || !node || !Number.isFinite(part) || textFrameElement(node)) return
  const targets = sectionBoxTargets(node)
  const first = targets[0]
  if (!first) return
  const widthEl = sectionWidthElement(node)
  const textFrame = textFrameElement(node)
  const widthStyle = view.getComputedStyle(widthEl)
  const startWidth = Math.max(24, Math.round(widthEl.getBoundingClientRect().width))
  const startMargin = Math.round(Number.parseFloat(widthStyle.marginLeft) || 0)
  const parentWidth = widthEl.parentElement?.clientWidth || startWidth
  const boxStyle = view.getComputedStyle(first)
  const startPadding = Math.round(Number.parseFloat(edge === 'n' ? boxStyle.paddingTop : boxStyle.paddingBottom) || 0)
  const point = pointerInFrame(event)
  try {
    doc.body.setPointerCapture(event.pointerId)
  } catch {
    /* Pointer tracking on the window covers the rest of the gesture. */
  }
  sectionResize = {
    part,
    edge,
    startX: point?.x ?? event.clientX,
    startY: point?.y ?? event.clientY,
    startPadding,
    paddingTop: edge === 'n' ? startPadding : Math.round(Number.parseFloat(boxStyle.paddingTop) || 0),
    paddingBottom: edge === 's' ? startPadding : Math.round(Number.parseFloat(boxStyle.paddingBottom) || 0),
    startWidth,
    width: startWidth,
    startMargin,
    marginLeft: startMargin,
    maxWidth: Math.max(startWidth, parentWidth),
    targets,
    widthEl,
    textFrame,
    minWord: textFrame ? longestWordPx(textFrame) : 48,
    scrollTop: frameScrollTop(doc),
    moved: false
  }
  doc.body.style.userSelect = 'none'
  doc.body.style.cursor = edge === 'n' || edge === 's' ? 'ns-resize' : 'ew-resize'
  startOutsideTracking()
  keepFrameScroll(doc, sectionResize.scrollTop)
}

function paintSectionResize(x: number, y: number) {
  const gesture = sectionResize
  if (!gesture) return
  const doc = gesture.widthEl.ownerDocument
  if (doc && frameScrollTop(doc) !== gesture.scrollTop) keepFrameScroll(doc, gesture.scrollTop)
  if (gesture.edge === 'n' || gesture.edge === 's') {
    const dy = y - gesture.startY
    if (Math.abs(dy) > 2) gesture.moved = true
    const next = Math.max(0, Math.min(160, Math.round(gesture.startPadding + (gesture.edge === 'n' ? -dy : dy))))
    if (gesture.edge === 'n') {
      gesture.paddingTop = next
      for (const target of gesture.targets) target.style.paddingTop = `${next}px`
    } else {
      gesture.paddingBottom = next
      for (const target of gesture.targets) target.style.paddingBottom = `${next}px`
    }
  } else {
    const dx = x - gesture.startX
    if (Math.abs(dx) > 2) gesture.moved = true
    if (gesture.edge === 'e' && dx >= 0) {
      gesture.width = gesture.startWidth
      const room = Math.max(0, gesture.maxWidth - gesture.width)
      gesture.marginLeft = Math.max(0, Math.min(room, Math.round(gesture.startMargin + dx)))
    } else if (gesture.edge === 'e') {
      gesture.width = clampDragWidth(gesture.startWidth + dx, gesture.maxWidth)
      gesture.marginLeft = Math.min(gesture.startMargin, Math.max(0, gesture.maxWidth - gesture.width))
    } else {
      gesture.width = clampDragWidth(gesture.startWidth - dx, gesture.maxWidth)
      const room = Math.max(0, gesture.maxWidth - gesture.width)
      gesture.marginLeft = Math.max(0, Math.min(room, Math.round(gesture.startMargin + gesture.startWidth - gesture.width)))
    }
    if (gesture.textFrame && gesture.width < gesture.minWord) {
      gesture.width = gesture.minWord
      const room = Math.max(0, gesture.maxWidth - gesture.width)
      gesture.marginLeft = Math.max(0, Math.min(room, gesture.marginLeft))
    }
    gesture.widthEl.style.width = `${gesture.width}px`
    if (gesture.textFrame) fitTextFrame(gesture.textFrame, gesture.width)
    gesture.widthEl.style.marginLeft = `${gesture.marginLeft}px`
    gesture.widthEl.style.marginRight = '0'
    if (gesture.widthEl.tagName === 'TABLE') {
      gesture.widthEl.setAttribute('width', String(gesture.width))
      gesture.widthEl.setAttribute('align', 'left')
    }
  }
  if (doc) placeSectionResizeHandle(doc)
}

function finishSectionResize() {
  const gesture = sectionResize
  if (!gesture) return
  sectionResize = null
  stopOutsideTracking()
  if (gestureFrame) {
    cancelAnimationFrame(gestureFrame)
    gestureFrame = 0
  }
  pendingGesturePoint = null
  const doc = gesture.widthEl.ownerDocument
  if (doc?.body) {
    doc.body.style.userSelect = ''
    doc.body.style.cursor = ''
  }
  if (!gesture.moved) {
    if (doc) placeSectionResizeHandle(doc)
    if (textEditing.value) void nextTick(() => inlineEditorRef.value?.focus())
    return
  }
  if (gesture.edge === 'n') applySectionBox(gesture.part, { paddingTop: gesture.paddingTop })
  else if (gesture.edge === 's') applySectionBox(gesture.part, { paddingBottom: gesture.paddingBottom })
  else applySectionBox(gesture.part, { width: gesture.width, marginLeft: gesture.marginLeft })
  if (textEditing.value) void nextTick(() => inlineEditorRef.value?.focus())
}

function paintGesture(x: number, y: number) {
  if (sectionResize) {
    paintSectionResize(x, y)
    return
  }
  if (sectionGesture) {
    paintSectionDrag(x, y)
    return
  }
  const gesture = imageGesture
  if (!gesture) return
  const doc = frameRef.value?.contentDocument
  const img = doc ? frameImage(doc, gesture.index) : null
  if (!doc || !img) return
  const dx = x - gesture.startX
  const dy = y - gesture.startY
  if (Math.abs(dx) + Math.abs(dy) > 2) gesture.moved = true
  if (frameScrollTop(doc) !== gesture.scrollTop) keepFrameScroll(doc, gesture.scrollTop)
  if (gesture.mode === 'move') {
    img.style.transform = `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0)`
    placeHandlesAt(doc, gesture.originX + dx, gesture.originY + dy, gesture.width, gesture.height)
    if (!gesture.moved) return
    const lastX = gesture.lastHitX
    const lastY = gesture.lastHitY
    if (lastX == null || lastY == null || Math.abs(x - lastX) + Math.abs(y - lastY) > 10) {
      gesture.lastHitX = x
      gesture.lastHitY = y
      const placement = slotPlacementAt(doc, x, y, img)
      gesture.placement = placement
      showDropLine(doc, placement)
    }
    return
  }
  const dir = gesture.dir
  if (!dir) return
  const live = resizeLive(gesture, dx, dy)
  gesture.live = live
  if (live.side) {
    img.style.transform = ''
    img.style.transformOrigin = ''
    img.style.width = `${Math.round(live.width)}px`
    img.style.maxWidth = '100%'
    img.style.height = `${Math.round(live.height)}px`
    img.style.objectFit = 'cover'
    img.style.objectPosition = live.objectPosition
    if (live.fromLeft) {
      img.style.marginLeft = `${Math.round(live.marginLeft)}px`
      img.style.marginRight = `${Math.round(live.marginRight)}px`
    }
    placeResizeHandles(doc, img)
    return
  }
  img.style.transformOrigin = RESIZE_ORIGIN[dir]
  img.style.transform = `scale(${live.scaleX}, ${live.scaleY})`
  placeHandlesAt(doc, live.x, live.y, live.width, live.height)
}

function queueGesturePoint(x: number, y: number) {
  pendingGesturePoint = { x, y }
  if (gestureFrame) return
  gestureFrame = requestAnimationFrame(() => {
    gestureFrame = 0
    const point = pendingGesturePoint
    pendingGesturePoint = null
    if (point) paintGesture(point.x, point.y)
  })
}

function stopOutsideTracking() {
  window.removeEventListener('pointermove', onOutsidePointer, true)
  window.removeEventListener('pointerup', onOutsidePointer, true)
  window.removeEventListener('pointercancel', onOutsidePointer, true)
}

function onOutsidePointer(event: PointerEvent) {
  const view = frameRef.value?.contentDocument?.defaultView
  if (textPress && !sectionResize && !sectionGesture && !imageGesture && (!view || event.view !== view)) {
    if (event.type === 'pointerup' || event.type === 'pointercancel') releaseTextPress(event, event.type === 'pointerup')
    else moveTextPress(event)
    return
  }
  if (!imageGesture && !sectionGesture && !sectionResize) return
  if (view && event.view === view) return
  const point = pointerInFrame(event)
  if (!point) return
  if (event.type === 'pointerup' || event.type === 'pointercancel') {
    onFramePointerUp(event)
    return
  }
  event.preventDefault()
  queueGesturePoint(point.x, point.y)
}

function startOutsideTracking() {
  stopOutsideTracking()
  window.addEventListener('pointermove', onOutsidePointer, true)
  window.addEventListener('pointerup', onOutsidePointer, true)
  window.addEventListener('pointercancel', onOutsidePointer, true)
}

function applyImagePlacement(doc: Document, img: HTMLImageElement, placement: EmailImagePlacement) {
  if (placement.kind === 'before-image') {
    const images = [...doc.querySelectorAll('img')]
    const dest = images[placement.index]
    if (!dest || dest === img || !dest.parentNode) return
    dest.parentNode.insertBefore(img, dest)
    return
  }
  const slot = doc.querySelector(`[data-email-slot="${placement.index}"]`)
  if (!slot?.parentNode) return
  if (placement.kind === 'before-block') slot.parentNode.insertBefore(img, slot)
  else if (placement.kind === 'after-block') slot.parentNode.insertBefore(img, slot.nextSibling)
  else if (placement.kind === 'end-of-block') slot.appendChild(img)
  else slot.insertBefore(img, slot.firstChild)
}

function elementFromEvent(doc: Document, target: EventTarget | null): HTMLElement | null {
  const view = doc.defaultView
  if (!view || !target || !(target instanceof view.Node)) return null
  if (target instanceof view.HTMLElement) return target
  const parent = target.parentElement
  return parent instanceof view.HTMLElement ? parent : null
}

function imageFromTarget(doc: Document, target: EventTarget | null): HTMLImageElement | null {
  const view = doc.defaultView
  if (!view || !target) return null
  let node: Node | null = target instanceof view.Node ? target : null
  while (node) {
    if (node instanceof view.HTMLImageElement) return node
    node = node.parentNode
  }
  return null
}

function moveTextPress(_event: PointerEvent) {
  // The words are a text box. A small move edits them and does not drag the section away.
}

function releaseTextPress(event: PointerEvent, edit: boolean) {
  const press = textPress
  if (!press) return
  textPress = null
  stopOutsideTracking()
  if (edit && press.el.isConnected) beginTextEdit(press.el, press.index, event)
}

function onFramePointerDown(event: PointerEvent) {
  const doc = frameRef.value?.contentDocument
  if (!doc?.body) return
  const target = elementFromEvent(doc, event.target)
  const sectionEdge = target?.dataset.sectionResize
  if (sectionEdge === 'n' || sectionEdge === 's' || sectionEdge === 'e' || sectionEdge === 'w') {
    if (pendingTextBlur) {
      window.clearTimeout(pendingTextBlur)
      pendingTextBlur = 0
    }
    event.preventDefault()
    event.stopPropagation()
    beginSectionResize(doc, event, sectionEdge)
    return
  }
  const handle = target?.dataset.resizeHandle as ResizeDir | undefined
  let img: HTMLImageElement | null = null
  let index = selectedIndex.value
  if (handle) {
    if (!props.canResizeImage || index == null) return
    img = frameImage(doc, index)
  } else {
    img = imageFromTarget(doc, event.target)
    if (img) index = [...doc.querySelectorAll('img')].indexOf(img)
  }
  const textEl = textElementFromTarget(target)
  const textIndex = Number(textEl?.getAttribute('data-email-text'))
  if (!img || index == null || index < 0) {
    const sectionEl = sectionElementFromTarget(target)
    const part = Number(sectionEl?.getAttribute('data-email-part'))
    const group = sectionEl?.getAttribute('data-email-group') || ''
    if (props.canEditText && textEl && Number.isFinite(textIndex)) {
      event.preventDefault()
      event.stopPropagation()
      if (activeTextEdit?.el === textEl) {
        if (textEditReady) ignoreTextBlur = true
        return
      }
      selectTextFromCanvas(textIndex)
      if (sectionEl && Number.isFinite(part)) selectSectionFromCanvas(part)
      textPress = {
        el: textEl,
        index: textIndex,
        sectionEl: sectionEl && group ? sectionEl : null,
        part: Number.isFinite(part) ? part : null,
        group,
        startX: event.clientX,
        startY: event.clientY
      }
      startOutsideTracking()
      return
    }
    pendingTextEdit = null
    if (sectionEl && Number.isFinite(part) && group) {
      selectedTextIndex.value = null
      paintArrangeOutline()
      event.preventDefault()
      event.stopPropagation()
      beginSectionDrag(doc, sectionEl, part, group, event)
      return
    }
    const clickedPart = Number(target?.closest('[data-email-part]')?.getAttribute('data-email-part'))
    selectedTextIndex.value = null
    paintArrangeOutline()
    if (Number.isFinite(clickedPart)) selectSectionFromCanvas(clickedPart)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const scrollTop = frameScrollTop(doc)
  try {
    doc.body.setPointerCapture(event.pointerId)
  } catch {
    /* Pointer tracking on the window covers the rest of the gesture. */
  }
  img.style.willChange = 'transform'
  img.style.position = 'relative'
  img.style.zIndex = '20'
  const computed = doc.defaultView?.getComputedStyle(img)
  const rect = img.getBoundingClientRect()
  const bodyRect = doc.body.getBoundingClientRect()
  imageGesture = {
    mode: handle ? 'resize' : 'move',
    dir: handle,
    index,
    startX: event.clientX,
    startY: event.clientY,
    originX: rect.left - bodyRect.left,
    originY: rect.top - bodyRect.top,
    width: rect.width,
    height: rect.height,
    marginLeft: Number.parseFloat(computed?.marginLeft || '') || 0,
    marginRight: Number.parseFloat(computed?.marginRight || '') || 0,
    scrollTop,
    moved: false
  }
  if (!handle) img.style.pointerEvents = 'none'
  doc.body.style.userSelect = 'none'
  doc.body.style.cursor = handle ? '' : 'grabbing'
  selectedIndex.value = index
  doc.querySelectorAll('img').forEach((node, imageIndex) => {
    const image = node as HTMLImageElement
    image.style.outline = imageIndex === index ? '2px solid #2563eb' : ''
    image.style.outlineOffset = '2px'
  })
  placeResizeHandles(doc, img)
  startOutsideTracking()
  keepFrameScroll(doc, scrollTop)
}

function onFramePointerMove(event: PointerEvent) {
  if (textPress) {
    moveTextPress(event)
    return
  }
  if (!imageGesture && !sectionGesture && !sectionResize) return
  const point = pointerInFrame(event)
  if (!point) return
  event.preventDefault()
  queueGesturePoint(point.x, point.y)
}

function onFramePointerUp(event: PointerEvent) {
  if (textPress) {
    releaseTextPress(event, event.type !== 'pointercancel')
    return
  }
  if (sectionResize) {
    finishSectionResize()
    return
  }
  if (sectionGesture) {
    finishSectionDrag(event)
    return
  }
  const gesture = imageGesture
  if (!gesture) return
  stopOutsideTracking()
  if (gestureFrame) {
    cancelAnimationFrame(gestureFrame)
    gestureFrame = 0
  }
  const point = pointerInFrame(event)
  if (point) paintGesture(point.x, point.y)
  pendingGesturePoint = null
  imageGesture = null
  const doc = frameRef.value?.contentDocument
  const img = doc ? frameImage(doc, gesture.index) : null
  if (doc?.body) {
    doc.body.style.userSelect = ''
    doc.body.style.cursor = ''
  }
  doc?.getElementById('email-builder-drop-line')?.remove()
  if (!doc || !img) return
  if (!gesture.moved) {
    releaseDraggedImage(img)
    placeResizeHandles(doc, img)
    selectImage(gesture.index, 'template')
    return
  }
  if (gesture.mode === 'resize') {
    if (!props.canResizeImage) {
      releaseDraggedImage(img)
      return
    }
    const live = gesture.live
    releaseDraggedImage(img)
    if (!live) {
      placeResizeHandles(doc, img)
      return
    }
    paintImageBox(img, {
      width: live.width,
      ...(live.side ? { height: live.height, objectPosition: live.objectPosition } : {}),
      ...(live.fromLeft ? { marginLeft: live.marginLeft, marginRight: live.marginRight } : {})
    })
    const next = updateEmailTemplateHtmlImageLayout(props.modelValue, gesture.index, {
      width: live.width,
      ...(live.side ? { height: live.height, objectPosition: live.objectPosition } : {}),
      ...(live.fromLeft ? { marginLeft: live.marginLeft, marginRight: live.marginRight } : {}),
      left: 0,
      top: 0
    })
    skipNextPreviewSync = true
    selectedIndex.value = gesture.index
    if (next !== props.modelValue) emit('update:modelValue', next)
    keepFrameScroll(doc, gesture.scrollTop)
    return
  }
  const target = readDropTarget(doc, point?.x ?? gesture.startX, point?.y ?? gesture.startY, img)
  const placement = gesture.placement || target.placement
  const moved = moveEmailTemplateHtmlImageTo(props.modelValue, gesture.index, placement)
  if (moved.html === props.modelValue || !placement) {
    releaseDraggedImage(img)
    keepFrameScroll(doc, gesture.scrollTop)
    placeResizeHandles(doc, img)
    return
  }
  applyImagePlacement(doc, img, placement)
  releaseDraggedImage(img)
  skipNextPreviewSync = true
  selectedIndex.value = moved.index
  emit('update:modelValue', moved.html)
  keepFrameScroll(doc, gesture.scrollTop)
  const placed = frameImage(doc, moved.index) || img
  placeResizeHandles(doc, placed)
}

function blockFrameLinkJump(event: Event) {
  const doc = frameRef.value?.contentDocument
  const view = doc?.defaultView
  const target = event.target
  if (!view || !target || !(target instanceof view.Node)) return
  let node: Node | null = target
  while (node) {
    if (node instanceof view.HTMLAnchorElement) {
      event.preventDefault()
      return
    }
    node = node.parentNode
  }
}

function bindFrameInteractions(doc: Document) {
  doc.removeEventListener('pointerdown', onFramePointerDown, true)
  doc.removeEventListener('pointermove', onFramePointerMove, true)
  doc.removeEventListener('pointerup', onFramePointerUp, true)
  doc.removeEventListener('pointercancel', onFramePointerUp, true)
  doc.removeEventListener('click', blockFrameLinkJump, true)
  doc.addEventListener('pointerdown', onFramePointerDown, true)
  doc.addEventListener('pointermove', onFramePointerMove, true)
  doc.addEventListener('pointerup', onFramePointerUp, true)
  doc.addEventListener('pointercancel', onFramePointerUp, true)
  doc.addEventListener('click', blockFrameLinkJump, true)
  doc.removeEventListener('keydown', onDeleteKey)
  doc.addEventListener('keydown', onDeleteKey)
  doc.removeEventListener('dragover', onFrameDragOver)
  doc.removeEventListener('drop', onFrameDrop)
  doc.addEventListener('dragover', onFrameDragOver)
  doc.addEventListener('drop', onFrameDrop)
}

function applyPreview(html: string) {
  const frame = frameRef.value
  if (!frame || frame.srcdoc === html) return
  const doc = frame.contentDocument
  scrollRestore = doc ? frameScrollTop(doc) : 0
  frame.srcdoc = html
}

watch(previewDoc, (html) => {
  if (textEditing.value) {
    previewHeld = true
    return
  }
  if (skipNextPreviewSync) {
    skipNextPreviewSync = false
    return
  }
  previewHeld = false
  nextTick(() => applyPreview(html))
}, { immediate: true })

function markImages() {
  const doc = frameRef.value?.contentDocument
  if (!doc?.body) return
  doc.documentElement.style.overflowAnchor = 'none'
  doc.body.style.position = 'relative'
  doc.body.style.overflowAnchor = 'none'
  if (scrollRestore != null) {
    const top = scrollRestore
    scrollRestore = null
    keepFrameScroll(doc, top)
  }
  bindFrameInteractions(doc)
  const textRule = '[data-email-text]{cursor:text}[data-email-text]:hover{outline:1px dashed #93c5fd;outline-offset:0}[data-email-editing],[data-email-editing] *{color:transparent!important;-webkit-text-fill-color:transparent!important}'
  let textStyle = doc.getElementById('email-builder-text-style')
  if (props.canEditText) {
    if (!textStyle) {
      textStyle = doc.createElement('style')
      textStyle.id = 'email-builder-text-style'
      doc.head?.appendChild(textStyle)
    }
    if (textStyle.textContent !== textRule) textStyle.textContent = textRule
  } else {
    textStyle?.remove()
  }
  doc.querySelectorAll('img').forEach((node, index) => {
    const img = node as HTMLImageElement
    img.draggable = false
    img.style.touchAction = 'none'
    const selected = index === selectedIndex.value
    img.style.cursor = 'move'
    img.style.outline = selected ? '2px solid #2563eb' : ''
    img.style.outlineOffset = '2px'
    const link = img.closest('a')
    if (link) link.onclick = (event) => event.preventDefault()
  })
  if (selectedIndex.value == null) {
    doc.getElementById('email-builder-handles')?.remove()
  } else {
    const selected = frameImage(doc, selectedIndex.value)
    if (selected) placeResizeHandles(doc, selected)
    else doc.getElementById('email-builder-handles')?.remove()
  }
  paintArrangeOutline()
  const resume = resumeTextEdit
  if (resume && props.canEditText) {
    resumeTextEdit = null
    const node = findTextRunElement(doc, resume.text, resume.nth)
    const index = Number(node?.getAttribute('data-email-text'))
    if (node && Number.isFinite(index)) openTextEditor(node, index)
  }
}

function paintArrangeOutline() {
  const doc = frameRef.value?.contentDocument
  const view = doc?.defaultView
  if (!doc || !view) return
  const resizeNode = selectedResizeElement(doc)
  doc.querySelectorAll('[data-email-part]').forEach((node) => {
    if (!(node instanceof view.HTMLElement)) return
    const textBox = contentRect(node)
    const hugsText = textBox.width < node.getBoundingClientRect().width - 8
    const on = node === resizeNode && !hugsText
    if (node.tagName === 'IMG') {
      node.style.boxShadow = on ? '0 0 0 2px #2563eb' : ''
      return
    }
    node.style.outline = on ? '2px solid #2563eb' : ''
    node.style.outlineOffset = on ? '0' : ''
    if (node.getAttribute('data-email-kind') === 'section') node.style.cursor = 'grab'
  })
  doc.querySelectorAll('[data-email-text]').forEach((node) => {
    if (!(node instanceof view.HTMLElement)) return
    node.style.outline = ''
    node.style.outlineOffset = ''
  })
  placeSectionResizeHandle(doc)
}

function focusArrangePart(part: number) {
  commitActiveTextEdit()
  selectedPart.value = blockPartFor(part)
  paintArrangeOutline()
  const node = frameRef.value?.contentDocument?.querySelector(`[data-email-part="${part}"]`)
  if (node && 'scrollIntoView' in node) {
    node.scrollIntoView({ block: 'center', inline: 'nearest' })
  }
}

function scrollTemplateToImage(index: number) {
  const doc = frameRef.value?.contentDocument
  const img = doc ? frameImage(doc, index) : null
  img?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
}

function scrollSidebarToImage(index: number) {
  const row = imageListRef.value?.querySelector(`[data-image-index="${index}"]`)
  row?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}

function imageFileLabel(src: string, index: number): string {
  const label = emailTemplateHtmlImageLabel(src, index)
  const file = label.split(' · ').slice(1).join(' · ')
  return file || 'No file name'
}

function selectImage(index: number, source: 'sidebar' | 'template' = 'sidebar') {
  selectedIndex.value = index
  imageUrl.value = previewSrc(images.value[index]?.src || '')
  uploadError.value = ''
  if (source === 'template') sidePanel.value = 'email'
  markImages()
  nextTick(() => {
    if (source === 'sidebar') scrollTemplateToImage(index)
    else scrollSidebarToImage(index)
  })
}

function startReplace(index: number) {
  if (!props.canUploadImage || uploading.value) return
  selectImage(index)
  replacePickerOpen.value = !replacePickerOpen.value
  if (replacePickerOpen.value && !hostedImages.value.length) void loadHostedImages()
}

function uploadReplacement() {
  if (!props.canUploadImage || uploading.value || selectedIndex.value == null) return
  fileMode.value = 'replace'
  fileInputRef.value?.click()
}

function replaceWithHosted(url: string) {
  if (selectedIndex.value == null) return
  applySrc(selectedIndex.value, url)
}

async function loadHostedImages() {
  if (!props.canUploadImage) return
  hostedPending.value = true
  hostedError.value = ''
  try {
    const response = await marketingApi.fetchEmailTemplateImages()
    hostedImages.value = (response.items ?? [])
      .filter((item) => typeof item.url === 'string' && item.url.trim())
      .map((item) => ({
        id: item.id || item.objectPath || item.url,
        url: item.url.trim(),
        fileName: item.fileName || 'Uploaded image'
      }))
  } catch {
    hostedError.value = 'Could not load uploaded images.'
    hostedImages.value = []
  } finally {
    hostedPending.value = false
  }
}

watch(() => props.canUploadImage, (allowed) => {
  if (allowed) void loadHostedImages()
}, { immediate: true })

function startInsert() {
  if (!props.canUploadImage || uploading.value) return
  fileMode.value = 'insert'
  uploadError.value = ''
  fileInputRef.value?.click()
}

function insertImage(url: string) {
  const next = insertEmailTemplateHtmlImage(props.modelValue, url)
  const index = Math.max(0, listEmailTemplateHtmlImages(next).length - 1)
  emit('update:modelValue', next)
  selectedIndex.value = index
  imageUrl.value = url
}

function insertImageAt(url: string, doc: Document, x: number, y: number) {
  const target = readDropTarget(doc, x, y)
  for (const needle of target.needles) {
    if (props.modelValue.split(needle).length !== 2) continue
    const next = insertEmailTemplateHtmlImageBeforeText(props.modelValue, url, needle)
    if (next !== props.modelValue) {
      const index = Math.max(0, listEmailTemplateHtmlImages(next).length - 1)
      emit('update:modelValue', next)
      selectedIndex.value = index
      imageUrl.value = url
      return
    }
  }
  if (!target.placement) return
  const placed = insertEmailTemplateHtmlImageAtPlacement(props.modelValue, url, target.placement)
  emit('update:modelValue', placed.html)
  selectedIndex.value = placed.index
  imageUrl.value = url
}

function deleteImage(index: number) {
  const next = removeEmailTemplateHtmlImage(props.modelValue, index)
  if (next === props.modelValue) return
  selectedIndex.value = null
  imageUrl.value = ''
  replacePickerOpen.value = false
  emit('update:modelValue', next)
}

function onDeleteKey(event: KeyboardEvent) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  const target = event.target
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
  }
  if (selectedIndex.value == null) return
  event.preventDefault()
  deleteImage(selectedIndex.value)
}

function onHostedDragStart(event: DragEvent, url: string) {
  hostedDragged = true
  event.dataTransfer?.setData('application/x-email-image', url)
  event.dataTransfer?.setData('text/plain', url)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onHostedClick(url: string) {
  if (hostedDragged) {
    hostedDragged = false
    return
  }
  insertImage(url)
}

function hostedDragType(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('application/x-email-image')
}

function onPreviewDragOver(event: DragEvent) {
  if (!hostedDragType(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  previewDropActive.value = true
}

function onPreviewDragLeave() {
  previewDropActive.value = false
}

let lastImageDropAt = 0

function dropHostedImage(event: DragEvent, x: number, y: number) {
  const url = event.dataTransfer?.getData('application/x-email-image') || ''
  if (!parseInsertableImageUrl(url)) return
  const now = Date.now()
  if (now - lastImageDropAt < 400) return
  lastImageDropAt = now
  event.preventDefault()
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  insertImageAt(url, doc, x, y)
}

function onFrameDragOver(event: DragEvent) {
  if (!hostedDragType(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  previewDropActive.value = true
}

function onFrameDrop(event: DragEvent) {
  previewDropActive.value = false
  const doc = frameRef.value?.contentDocument
  const view = doc?.defaultView
  const target = view && event.target instanceof view.Element ? event.target as HTMLElement : null
  const point = doc ? pointInFrame(event, doc, target) : { x: event.clientX, y: event.clientY }
  dropHostedImage(event, point.x, point.y)
}

function onPreviewDrop(event: DragEvent) {
  previewDropActive.value = false
  const frame = frameRef.value
  if (!frame) return
  const frameRect = frame.getBoundingClientRect()
  dropHostedImage(event, event.clientX - frameRect.left, event.clientY - frameRect.top)
}

onMounted(() => window.addEventListener('keydown', onDeleteKey))
onBeforeUnmount(() => {
  textPress = null
  window.clearTimeout(pendingTextBlur)
  pendingTextBlur = 0
  if (textEditReady) commitActiveTextEdit()
  else if (activeTextEdit) {
    const previous = activeTextEdit
    activeTextEdit = null
    textEditing.value = false
    textEditReady = false
    openingTextEdit = false
    detachTextEdit(previous.el, previous.previousColor)
    clearEditingMarks()
  }
  stopOutsideTracking()
  if (gestureFrame) cancelAnimationFrame(gestureFrame)
  window.removeEventListener('keydown', onDeleteKey)
})

function applySrc(index: number, url: string) {
  const next = replaceEmailTemplateHtmlImageSrc(props.modelValue, index, url)
  if (next === props.modelValue) {
    uploadError.value = 'Could not find that image in the template anymore.'
    return
  }
  emit('update:modelValue', next)
  selectedIndex.value = index
  imageUrl.value = url
  replacePickerOpen.value = false
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const mode = fileMode.value
  const index = selectedIndex.value
  if (!file || !props.canUploadImage) return
  if (mode === 'replace' && index == null) return
  uploading.value = true
  uploadError.value = ''
  try {
    const dataUrl = await compressCustomMarketingImageFile(file, { maxSourceBytes: 8 * 1024 * 1024 })
    const uploaded = await marketingApi.uploadEmailTemplateImage({ dataUrl })
    const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
    if (!url) throw new Error('Upload succeeded but no image link was returned.')
    if (mode === 'insert') insertImage(url)
    else if (index != null) applySrc(index, url)
    await loadHostedImages()
  } catch (err) {
    const data = err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
    uploadError.value = data?.statusMessage || data?.message || (err instanceof Error ? err.message : 'Could not upload image.')
  } finally {
    uploading.value = false
  }
}

function readImageUrl(): string | null {
  const url = parseInsertableImageUrl(imageUrl.value)
  if (!url) {
    uploadError.value = 'Use an http or https image link.'
    return null
  }
  uploadError.value = ''
  return url
}

function applyUrl() {
  if (selectedIndex.value == null) return
  const url = readImageUrl()
  if (!url) return
  applySrc(selectedIndex.value, url)
}

function insertFromUrl() {
  if (!props.canUploadImage) return
  const url = readImageUrl()
  if (!url) return
  insertImage(url)
}

async function openTemplateList() {
  templatesOpen.value = !templatesOpen.value
  if (!templatesOpen.value || templates.value.length || templatesPending.value) return
  templatesPending.value = true
  templatesError.value = ''
  try {
    const response = await marketingApi.fetchEmailTemplates()
    templates.value = (response.templates ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      subject: template.subject || '',
      html: template.htmlTemplate || ''
    }))
  } catch {
    templatesError.value = 'Could not load templates.'
  } finally {
    templatesPending.value = false
  }
}

async function loadTemplate(id: string) {
  templatesPending.value = true
  templatesError.value = ''
  try {
    const response = await marketingApi.fetchEmailTemplateById(id)
    const html = response.template.htmlTemplate || ''
    originalHtml.value = html
    emit('update:modelValue', html)
    emit('loaded-template', {
      name: response.template.name || '',
      subject: response.template.subject || ''
    })
    selectedIndex.value = null
    imageUrl.value = ''
    templatesOpen.value = false
  } catch {
    templatesError.value = 'Could not open that template.'
  } finally {
    templatesPending.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 bg-white">
    <aside class="flex w-96 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-3 py-3">
        <p class="text-sm font-semibold text-slate-900">{{ templatesOpen ? 'Templates' : sidePanel === 'layout' ? 'Sections' : sidePanel === 'uploads' ? 'Uploads' : 'Images' }}</p>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-white"
            :disabled="!canResetDesign"
            @click="resetDesign"
          >
            Reset
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold shadow-sm"
            :class="templatesOpen ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'"
            @click="openTemplateList"
          >
            {{ templatesOpen ? 'Hide templates' : 'Load template' }}
          </button>
        </div>
      </div>
      <div v-if="templatesOpen" class="min-h-0 flex-1 overflow-auto bg-slate-50 p-2">
        <p v-if="templatesError" class="px-1 py-2 text-xs text-red-600">{{ templatesError }}</p>
        <p v-else-if="templatesPending" class="px-1 py-2 text-xs text-slate-500">Loading templates…</p>
        <p v-else-if="!templates.length" class="px-1 py-2 text-xs text-slate-500">No saved templates.</p>
        <ul v-else class="space-y-2">
          <li v-for="template in templates" :key="template.id">
            <button
              type="button"
              class="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm hover:border-slate-400"
              :aria-label="template.name ? `Load ${template.name}` : 'Load template'"
              @click="loadTemplate(template.id)"
            >
              <span class="relative block h-28 w-full bg-[#f8f4ef]">
                <TenantEmailTemplateThumbnail
                  v-if="template.html.trim()"
                  :html="template.html"
                  class="absolute inset-0"
                />
                <span v-else class="flex h-full items-center justify-center text-xs text-slate-400">No preview</span>
              </span>
              <span class="block px-2 py-1.5">
                <span class="block truncate text-sm font-medium text-slate-800">{{ template.name }}</span>
                <span v-if="template.subject" class="block truncate text-xs text-slate-500">{{ template.subject }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div
        v-if="!templatesOpen"
        class="grid gap-1 border-b border-slate-200 p-2"
        :class="canUploadImage ? 'grid-cols-3' : 'grid-cols-1'"
      >
        <button
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold"
          :class="sidePanel === 'layout' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="sidePanel = 'layout'"
        >
          Sections
          <span class="ml-1 font-normal opacity-70">{{ sectionCards.length }}</span>
        </button>
        <button
          v-if="canUploadImage"
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold"
          :class="sidePanel === 'email' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="sidePanel = 'email'"
        >
          Images
          <span class="ml-1 font-normal opacity-70">{{ images.length }}</span>
        </button>
        <button
          v-if="canUploadImage"
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold"
          :class="sidePanel === 'uploads' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="sidePanel = 'uploads'"
        >
          Uploads
        </button>
      </div>

      <div v-if="!templatesOpen" class="min-h-0 flex-1 overflow-auto p-3">
        <p v-if="uploadError" class="mb-2 text-xs text-red-600">{{ uploadError }}</p>

        <div v-if="sidePanel === 'layout'">
          <p class="mb-3 text-sm leading-relaxed text-slate-600">
            {{ canEditText ? 'Click the words, then change the text, font, size, bold, italic, or color.' : 'Click a block to select it.' }}
          </p>
          <p v-if="!sectionCards.length" class="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">
            {{ canEditText ? 'Click the words in the email to edit them.' : 'No blocks found in this email.' }}
          </p>
          <ul v-else ref="sectionListRef" class="space-y-2">
            <li
              v-for="item in sectionCards"
              :key="`${item.group}-${item.part}`"
              :data-section-part="item.part"
              class="rounded-xl border"
              :class="selectedPart === item.part ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500' : 'border-slate-200 bg-white'"
            >
              <div class="px-2.5 py-2">
                <button
                  type="button"
                  class="w-full text-left"
                  @click="focusArrangePart(item.part)"
                >
                  <span class="text-[11px] font-medium text-slate-500">{{ sectionKindLabel(item.kind) }}</span>
                  <span class="mt-0.5 block truncate text-sm font-medium text-slate-900">{{ item.label }}</span>
                </button>
              </div>
              <div v-if="selectedPart === item.part" class="space-y-3 border-t border-blue-100 px-2.5 py-2.5">
                <div v-if="item.kind !== 'image'" class="space-y-3 rounded-lg bg-white/80 p-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium text-slate-700">Block color</span>
                    <span class="flex items-center gap-2">
                      <span class="text-[11px] text-slate-400">{{ sectionBox(item.part).background ? '' : 'None' }}</span>
                      <span class="relative inline-flex h-8 w-8 overflow-hidden rounded-md border border-slate-300 bg-slate-100">
                        <input
                          type="color"
                          class="absolute inset-0 h-full w-full cursor-pointer border-0 p-0"
                          aria-label="Block color"
                          :value="sectionBox(item.part).background || '#ffffff'"
                          @input="onSectionBackground(item.part, $event)"
                        >
                      </span>
                    </span>
                  </div>
                </div>
                <template v-if="item.kind === 'image'">
                  <p class="text-sm text-slate-600">This is a photo.</p>
                  <button
                    v-if="canUploadImage"
                    type="button"
                    class="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    @click="sidePanel = 'email'"
                  >
                    Change photo
                  </button>
                </template>
                <template v-else-if="selectedTextRuns.length && canEditText">
                  <template v-for="(run, runPosition) in selectedTextRuns" :key="`${run.index}-${run.start}`">
                    <div
                      v-if="selectedTextIndex === run.index || (selectedTextIndex == null && runPosition === 0)"
                      :data-text-run="run.index"
                      class="space-y-2 rounded-lg bg-white p-2 ring-2 ring-blue-500"
                    >
                      <label class="block">
                        <span class="text-[11px] font-medium text-slate-500">Words</span>
                        <textarea
                          rows="2"
                          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          :value="textFieldValue(run.index, run.text)"
                          @focus="onTextFieldFocus(run.index)"
                          @input="onTextDraft(run.index, $event)"
                          @blur="commitTextField(run.index)"
                        />
                      </label>
                      <div class="grid grid-cols-2 gap-2">
                        <label class="block min-w-0">
                          <span class="text-[11px] font-medium text-slate-500">Font</span>
                          <select
                            class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
                            aria-label="Font"
                            :value="textRunStyle(run.index).font"
                            @change="onTextFont(run.index, $event)"
                          >
                            <option value="">Default</option>
                            <option v-for="font in EMAIL_TEXT_FONTS" :key="font.id" :value="font.id">{{ font.label }}</option>
                          </select>
                        </label>
                        <label class="block">
                          <span class="text-[11px] font-medium text-slate-500">Size</span>
                          <span class="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <input
                              type="number"
                              :min="EMAIL_TEXT_SIZE_MIN"
                              :max="EMAIL_TEXT_SIZE_MAX"
                              step="1"
                              class="w-full bg-transparent text-xs text-slate-800 outline-none"
                              aria-label="Text size"
                              placeholder="Size"
                              :value="textRunStyle(run.index).size ?? ''"
                              @change="onTextSize(run.index, $event)"
                              @keydown.enter.prevent="finishTextSize"
                            >
                            <span class="text-[10px] text-slate-400">px</span>
                          </span>
                        </label>
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <label class="flex items-center gap-2">
                          <span class="text-[11px] font-medium text-slate-500">Color</span>
                          <span class="relative inline-flex h-8 w-8 overflow-hidden rounded-md border border-slate-300 bg-slate-100">
                            <input
                              type="color"
                              class="absolute inset-0 h-full w-full cursor-pointer border-0 p-0"
                              aria-label="Text color"
                              :value="textRunStyle(run.index).color || '#222222'"
                              @input="onTextColor(run.index, $event)"
                            >
                          </span>
                        </label>
                        <span class="flex items-center gap-1.5">
                          <button
                            type="button"
                            class="rounded-lg border px-3 py-1.5 text-sm font-bold"
                            :class="textRunStyle(run.index).bold ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
                            :aria-pressed="textRunStyle(run.index).bold"
                            aria-label="Bold"
                            @click="toggleTextBold(run.index)"
                          >
                            Bold
                          </button>
                          <button
                            type="button"
                            class="rounded-lg border px-3 py-1.5 text-sm italic"
                            :class="textRunStyle(run.index).italic ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
                            :aria-pressed="textRunStyle(run.index).italic"
                            aria-label="Italic"
                            @click="toggleTextItalic(run.index)"
                          >
                            Italic
                          </button>
                        </span>
                      </div>
                    </div>
                    <button
                      v-else
                      type="button"
                      :data-text-run="run.index"
                      class="block w-full truncate rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm text-slate-800 hover:border-blue-400"
                      @click="selectedTextIndex = run.index"
                    >
                      {{ run.text }}
                    </button>
                  </template>
                </template>
                <div v-else-if="selectedTextRuns.length" class="space-y-1">
                  <p
                    v-for="run in selectedTextRuns"
                    :key="`${run.index}-${run.start}`"
                    :data-text-run="run.index"
                    class="rounded-md px-1.5 py-1 text-sm text-slate-700"
                    :class="selectedTextIndex === run.index ? 'bg-blue-100 ring-2 ring-blue-500' : ''"
                  >
                    {{ run.text }}
                  </p>
                </div>
                <p v-else class="text-sm text-slate-500">This block has no words to edit.</p>
              </div>
            </li>
          </ul>
        </div>

        <div v-else-if="sidePanel === 'uploads' && canUploadImage">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-sm text-slate-600">Click a photo to add it, or drag it onto the email.</p>
            <button
              type="button"
              class="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              :disabled="uploading"
              @click="startInsert"
            >
              {{ uploading && fileMode === 'insert' ? 'Uploading…' : 'Upload' }}
            </button>
          </div>
          <p v-if="hostedError" class="text-xs text-red-600">{{ hostedError }}</p>
          <p v-else-if="hostedPending && !hostedImages.length" class="text-xs text-slate-500">Loading uploaded images…</p>
          <p v-else-if="!hostedImages.length" class="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">
            No uploaded images yet.
          </p>
          <ul v-else class="grid grid-cols-2 gap-2">
            <li v-for="item in hostedImages" :key="item.id">
              <button
                type="button"
                draggable="true"
                class="block w-full cursor-grab overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-500 active:cursor-grabbing"
                :title="item.fileName"
                :aria-label="`Insert ${item.fileName}`"
                @dragstart="onHostedDragStart($event, item.url)"
                @dragend="hostedDragged = true"
                @click="onHostedClick(item.url)"
              >
                <img :src="item.url" alt="" draggable="false" class="pointer-events-none h-24 w-full object-contain">
              </button>
            </li>
          </ul>
        </div>

        <template v-else>
          <p v-if="!canUploadImage" class="mb-2 text-sm text-slate-600">
            {{ canResizeImage ? 'You can still move, resize, and remove photos in this email.' : 'You can still move and remove photos in this email.' }}
          </p>
          <p v-else-if="!images.length" class="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">
            This email has no photos yet. Add one from Uploads.
          </p>
          <ul v-else ref="imageListRef" class="space-y-1.5">
            <li v-for="image in images" :key="image.index">
              <div
                class="flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left"
                :class="selectedIndex === image.index ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-transparent hover:bg-slate-50'"
                :data-image-index="image.index"
                role="button"
                tabindex="0"
                @click="selectImage(image.index, 'sidebar')"
                @keydown.enter.prevent="selectImage(image.index, 'sidebar')"
              >
                <img
                  v-if="previewSrc(image.src)"
                  :src="previewSrc(image.src)"
                  alt=""
                  class="h-11 w-11 shrink-0 rounded-md bg-white object-contain ring-1 ring-slate-200"
                >
                <span v-else class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400 ring-1 ring-slate-200">Empty</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-slate-900">Photo {{ image.index + 1 }}</span>
                  <span class="block truncate text-[11px] text-slate-500">{{ imageFileLabel(image.src, image.index) }}</span>
                </span>
              </div>
            </li>
          </ul>
        </template>
      </div>

      <div v-if="!templatesOpen && sidePanel !== 'layout' && (selectedIndex != null || canUploadImage)" class="border-t border-slate-200 bg-white p-3">
        <div v-if="selectedIndex != null" class="flex gap-2">
          <button
            v-if="canUploadImage"
            type="button"
            class="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            :disabled="uploading"
            @click="startReplace(selectedIndex)"
          >
            Change
          </button>
          <button
            type="button"
            class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            @click="deleteImage(selectedIndex)"
          >
            Remove
          </button>
        </div>
        <p v-else class="text-sm text-slate-600">Click a photo to change or remove it.</p>

        <div v-if="replacePickerOpen && selectedIndex != null && canUploadImage" class="mt-3">
          <p class="text-xs font-medium text-slate-700">Replace with</p>
          <p v-if="hostedPending && !hostedImages.length" class="mt-2 text-xs text-slate-500">Loading uploaded images…</p>
          <p v-else-if="!hostedImages.length" class="mt-2 text-xs text-slate-500">No uploaded images yet.</p>
          <ul v-else class="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-auto">
            <li v-for="item in hostedImages" :key="`replace-${item.id}`">
              <button
                type="button"
                class="block w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-blue-500"
                :title="item.fileName"
                :aria-label="`Replace with ${item.fileName}`"
                @click="replaceWithHosted(item.url)"
              >
                <img :src="item.url" alt="" class="h-12 w-full object-contain">
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
            :disabled="uploading"
            @click="uploadReplacement"
          >
            {{ uploading && fileMode === 'replace' ? 'Uploading…' : 'Or upload a file' }}
          </button>
        </div>

        <div v-if="canUploadImage" class="mt-3">
          <button
            type="button"
            class="text-xs font-medium text-slate-600 hover:text-slate-900"
            @click="linkOpen = !linkOpen"
          >
            {{ linkOpen ? 'Hide link' : 'Paste an image link' }}
          </button>
          <div v-if="linkOpen" class="mt-2">
            <input
              id="template-image-url"
              v-model="imageUrl"
              type="url"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              placeholder="https://"
            >
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                @click="insertFromUrl"
              >
                Insert
              </button>
              <button
                v-if="selectedIndex != null"
                type="button"
                class="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                @click="applyUrl"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        class="hidden"
        @change="onFile"
      >
    </aside>
    <div
      ref="previewCanvasRef"
      class="relative min-h-0 min-w-0 flex-1 self-stretch overflow-hidden"
      :class="previewDropActive ? 'bg-blue-50' : ''"
      @dragover="onPreviewDragOver"
      @dragleave="onPreviewDragLeave"
      @drop="onPreviewDrop"
    >
      <p
        v-if="previewDropActive"
        class="pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm font-medium text-blue-700"
      >
        Drop to place the image
      </p>
      <iframe
        ref="frameRef"
        class="absolute inset-0 block h-full w-full border-0 bg-white"
        :class="previewDropActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'"
        title="Email template"
        data-vue-devtools-ignore
        sandbox="allow-same-origin"
        @load="markImages"
        @dragover="onPreviewDragOver"
        @dragleave="onPreviewDragLeave"
        @drop="onPreviewDrop"
      />
      <textarea
        v-show="textEditing"
        ref="inlineEditorRef"
        class="absolute z-20 m-0 box-border resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:outline-none"
        :style="inlineEditorStyle"
        aria-label="Edit text"
        spellcheck="true"
        @input="onInlineEditorInput"
        @blur="onInlineEditorBlur"
        @keydown.enter="onInlineEditorEnter"
        @keydown.esc.prevent="cancelInlineEditor"
      />
    </div>
    <Teleport to="body">
      <div
        v-if="resetConfirmOpen"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-email-design-title"
        @click.self="resetConfirmOpen = false"
        @keydown.esc="resetConfirmOpen = false"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
          <h3 id="reset-email-design-title" class="text-lg font-semibold text-slate-900">
            Restore the original design?
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600">
            This removes image moves, resizes, and photos you added, and puts the email back to the design you started with.
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              @click="resetConfirmOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              @click="confirmResetDesign"
            >
              Restore
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
