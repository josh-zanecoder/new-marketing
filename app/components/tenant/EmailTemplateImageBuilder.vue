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

const props = defineProps<{
  modelValue: string
  canUploadImage: boolean
  sourceHtml?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [html: string]
  'loaded-template': [{ name: string; subject: string }]
}>()

const marketingApi = useTenantMarketingApi()
const frameRef = ref<HTMLIFrameElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageListRef = ref<HTMLElement | null>(null)
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
const sidePanel = ref<'email' | 'uploads'>('email')
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
  const html = emailPreviewDocument(emailPreviewWithBlockMarkers(emailClientSafeImageHtml(originalHtml.value)))
  frame.srcdoc = ''
  frame.srcdoc = html
}

const images = computed(() => listEmailTemplateHtmlImages(props.modelValue))
const previewDoc = computed(() =>
  emailPreviewDocument(emailPreviewWithBlockMarkers(emailClientSafeImageHtml(props.modelValue)))
)
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

function paintGesture(x: number, y: number) {
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
  if (!imageGesture) return
  const view = frameRef.value?.contentDocument?.defaultView
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

function frameTarget(doc: Document, target: EventTarget | null): HTMLElement | null {
  const view = doc.defaultView
  if (!view || !target || !(target instanceof view.HTMLElement)) return null
  return target
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

function onFramePointerDown(event: PointerEvent) {
  const doc = frameRef.value?.contentDocument
  if (!doc?.body) return
  const target = frameTarget(doc, event.target)
  const handle = target?.dataset.resizeHandle as ResizeDir | undefined
  let img: HTMLImageElement | null = null
  let index = selectedIndex.value
  if (handle) {
    if (index == null) return
    img = frameImage(doc, index)
  } else {
    img = imageFromTarget(doc, event.target)
    if (img) index = [...doc.querySelectorAll('img')].indexOf(img)
  }
  if (!img || index == null || index < 0) return
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
  if (!imageGesture) return
  const point = pointerInFrame(event)
  if (!point) return
  event.preventDefault()
  queueGesturePoint(point.x, point.y)
}

function onFramePointerUp(event: PointerEvent) {
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
  if (skipNextPreviewSync) {
    skipNextPreviewSync = false
    return
  }
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
    return
  }
  const selected = frameImage(doc, selectedIndex.value)
  if (selected) placeResizeHandles(doc, selected)
  else doc.getElementById('email-builder-handles')?.remove()
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
  <div class="flex min-h-0 flex-1 bg-[#eef1f4]">
    <aside class="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <p class="text-sm font-semibold text-slate-900">Images</p>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
            :disabled="!canResetDesign"
            @click="resetDesign"
          >
            Reset
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
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

      <div v-if="canUploadImage && !templatesOpen" class="grid grid-cols-2 gap-1 border-b border-slate-200 p-2">
        <button
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold"
          :class="sidePanel === 'email' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="sidePanel = 'email'"
        >
          In email
          <span class="ml-1 font-normal opacity-70">{{ images.length }}</span>
        </button>
        <button
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

        <div v-if="sidePanel === 'uploads' && canUploadImage">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-xs text-slate-500">Drag a photo onto the email.</p>
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
          <p v-if="!canUploadImage" class="mb-2 text-xs text-slate-500">
            Insert image is turned off. You can still move, resize, and delete images in this email.
          </p>
          <p v-else-if="!images.length" class="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">
            This email has no images yet. Add one from Uploads.
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
                  <span class="block text-xs font-medium text-slate-900">Image {{ image.index + 1 }}</span>
                  <span class="block truncate text-[11px] text-slate-500">{{ imageFileLabel(image.src, image.index) }}</span>
                </span>
              </div>
            </li>
          </ul>
        </template>
      </div>

      <div v-if="!templatesOpen && (selectedIndex != null || canUploadImage)" class="border-t border-slate-200 bg-white p-3">
        <div v-if="selectedIndex != null" class="flex gap-2">
          <button
            v-if="canUploadImage"
            type="button"
            class="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            :disabled="uploading"
            @click="startReplace(selectedIndex)"
          >
            Replace
          </button>
          <button
            type="button"
            class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            @click="deleteImage(selectedIndex)"
          >
            Delete
          </button>
        </div>
        <p v-else class="text-xs text-slate-500">Select an image in the email to replace or delete it.</p>

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
      class="relative min-w-0 flex-1 overflow-auto px-4 py-6"
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
        class="block h-[calc(100vh-120px)] w-full rounded-lg border bg-white shadow-md"
        :class="previewDropActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'"
        title="Email template"
        data-vue-devtools-ignore
        sandbox="allow-same-origin"
        @load="markImages"
        @dragover="onPreviewDragOver"
        @dragleave="onPreviewDragLeave"
        @drop="onPreviewDrop"
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
