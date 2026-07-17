import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import type { Editor as CoreEditor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { CustomMarketingParagraphIndent } from '~~/shared/customMarketingParagraphIndent'
import { CustomMarketingListEnter, CustomMarketingListItem, splitOrInsertListItem } from '~~/shared/customMarketingListItem'
import {
  CustomMarketingDraggableImage,
  customMarketingAlignCommandValue,
  normalizeCustomMarketingImageAlign
} from '~~/shared/customMarketingDraggableImage'
import {
  CustomMarketingColumn,
  CustomMarketingColumns
} from '~~/shared/customMarketingTwoColumn'
import {
  firstImageFileFromDataTransfer,
  shouldAcceptExternalImageDrop
} from '~~/shared/customMarketingImageDrag'
import {
  CUSTOM_MARKETING_DEFAULT_FONT_FAMILY,
  CUSTOM_MARKETING_DEFAULT_FONT_SIZE,
  CUSTOM_MARKETING_DEFAULT_TEXT_COLOR,
  CUSTOM_MARKETING_FONT_FAMILIES,
  CUSTOM_MARKETING_FONT_SIZES,
  CUSTOM_MARKETING_IMAGE_WIDTH_PRESETS,
  textStyleAttrsMatch,
  type CustomMarketingImageWidthPreset,
  type CustomMarketingTextStyleAttrs
} from '~~/shared/customMarketingEditorOptions'
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import {
  customMarketingGmailClipWarning
} from '~~/shared/customMarketingEmailSize'
import { wrapCustomMarketingRichHtml } from '~~/shared/customMarketingEmail'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'

export type CustomMarketingRichTextEditorBinders = {
  editor: ReturnType<typeof useEditor>
  EditorContent: typeof EditorContent
  fontFamilies: typeof CUSTOM_MARKETING_FONT_FAMILIES
  fontSizes: typeof CUSTOM_MARKETING_FONT_SIZES
  imageWidthPresets: typeof CUSTOM_MARKETING_IMAGE_WIDTH_PRESETS
  selectedFontFamily: Ref<string>
  selectedFontSize: Ref<string>
  selectedColor: Ref<string>
  selectedHighlight: Ref<string>
  imageInputRef: Ref<HTMLInputElement | null>
  imageError: Ref<string>
  imageUploading: Ref<boolean>
  isImageSelected: ComputedRef<boolean>
  selectedImageWidth: ComputedRef<number | null>
  gmailClipWarning: ComputedRef<string | null>
  isBold: ComputedRef<boolean>
  isItalic: ComputedRef<boolean>
  isUnderline: ComputedRef<boolean>
  isStrike: ComputedRef<boolean>
  isSubscript: ComputedRef<boolean>
  isSuperscript: ComputedRef<boolean>
  isBulletList: ComputedRef<boolean>
  isOrderedList: ComputedRef<boolean>
  isAlignLeft: ComputedRef<boolean>
  isAlignCenter: ComputedRef<boolean>
  isAlignRight: ComputedRef<boolean>
  isAlignJustify: ComputedRef<boolean>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  applyFontFamily: (value: string) => void
  applyFontSize: (value: string) => void
  applyColor: (value: string) => void
  applyHighlight: (value: string) => void
  clearHighlight: () => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrike: () => void
  toggleSubscript: () => void
  toggleSuperscript: () => void
  toggleBulletList: () => void
  toggleOrderedList: () => void
  setAlign: (align: 'left' | 'center' | 'right' | 'justify') => void
  indent: () => void
  outdent: () => void
  undo: () => void
  redo: () => void
  clearFormatting: () => void
  openImagePicker: () => void
  onImageFileChange: (ev: Event) => Promise<void>
  setImageWidthPreset: (width: CustomMarketingImageWidthPreset) => void
  deleteSelectedImage: () => void
  insertTwoColumns: () => void
  deleteTwoColumns: () => void
  isInTwoColumns: ComputedRef<boolean>
  toolbarBtnClass: (active: boolean) => string
}

async function insertImageFromFile(
  editor: CoreEditor,
  file: File,
  upload: (dataUrl: string) => Promise<string>
): Promise<void> {
  const dataUrl = await compressCustomMarketingImageFile(file)
  const src = await upload(dataUrl)
  // Float left by default + trailing paragraph so you can type beside the photo immediately.
  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'image', attrs: { src, textAlign: 'left' } },
      { type: 'paragraph' }
    ])
    .run()
}

export function useCustomMarketingRichTextEditor(options: {
  model: Ref<string>
  placeholder?: string
  /** Optional GCS folder: custom-marketing/{tenantName}/{recipientListId|no-list}/ */
  recipientListId?: MaybeRefOrGetter<string>
}): CustomMarketingRichTextEditorBinders {
  const placeholder = options.placeholder ?? 'Start typing your message…'
  const marketingApi = useTenantMarketingApi()
  const selectedFontFamily = ref<string>(CUSTOM_MARKETING_DEFAULT_FONT_FAMILY)
  const selectedFontSize = ref<string>(CUSTOM_MARKETING_DEFAULT_FONT_SIZE)
  const selectedColor = ref(CUSTOM_MARKETING_DEFAULT_TEXT_COLOR)
  const selectedHighlight = ref('#ffff00')
  const imageInputRef = ref<HTMLInputElement | null>(null)
  const imageError = ref('')
  const imageUploading = ref(false)
  const selectionTick = ref(0)
  const applyingToolbarMarks = ref(false)

  async function hostCompressedImage(dataUrl: string): Promise<string> {
    const recipientListId = String(toValue(options.recipientListId) ?? '').trim()
    const uploaded = await marketingApi.uploadCustomMarketingImage({
      dataUrl,
      ...(recipientListId ? { recipientListId } : {})
    })
    return uploaded.url
  }

  async function insertImageWithLoader(file: File, failLabel: string): Promise<void> {
    if (!editor.value || imageUploading.value) return
    imageError.value = ''
    imageUploading.value = true
    try {
      await insertImageFromFile(editor.value, file, hostCompressedImage)
    } catch (err) {
      imageError.value = err instanceof Error ? err.message : failLabel
    } finally {
      imageUploading.value = false
    }
  }

  const gmailClipWarning = computed(() =>
    customMarketingGmailClipWarning(wrapCustomMarketingRichHtml(options.model.value || ''))
  )

  const editor = useEditor({
    content: options.model.value || '<p></p>',
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        // Added separately below — avoid duplicate underline registration.
        underline: false,
        // Custom list item: one paragraph per item so Enter adds a new bullet.
        listItem: false,
        // Trailing empty <p> after lists steals focus so Enter no longer adds bullets.
        trailingNode: false,
        dropcursor: {
          color: '#1a73e8',
          width: 2,
          class: 'custom-marketing-editor__dropcursor'
        }
      }),
      CustomMarketingListItem,
      CustomMarketingListEnter,
      TextStyleKit,
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['paragraph'],
        alignments: ['left', 'center', 'right', 'justify']
      }),
      CustomMarketingParagraphIndent,
      CustomMarketingDraggableImage.configure({
        // Base64 is compressed client-side then uploaded to GCS; editor stores HTTPS URLs.
        allowBase64: true,
        inline: false,
        HTMLAttributes: { class: 'custom-marketing-editor__image' }
      }),
      CustomMarketingColumns,
      CustomMarketingColumn,
      Placeholder.configure({ placeholder })
    ],
    editorProps: {
      attributes: {
        class: 'custom-marketing-editor__content',
        'aria-label': 'Email message'
      },
      handleKeyDown(_view, event) {
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          return false
        }
        const current = editor.value
        if (!current) return false
        return splitOrInsertListItem(current, 'listItem')
      },
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageItem = items.find((item) => item.type.startsWith('image/'))
        if (!imageItem) return false
        const file = imageItem.getAsFile()
        if (!file || !editor.value) return false
        event.preventDefault()
        void insertImageWithLoader(file, 'Could not paste image')
        return true
      },
      handleDrop(_view, event, _slice, moved) {
        // Let ProseMirror reposition existing images; only upload external files.
        if (!shouldAcceptExternalImageDrop(moved, event)) return false
        const imageFile = firstImageFileFromDataTransfer(event.dataTransfer)
        if (!imageFile || !editor.value) return false
        event.preventDefault()
        void insertImageWithLoader(imageFile, 'Could not drop image')
        return true
      }
    },
    onCreate: ({ editor: created }) => {
      applyTextStyleMark(created, {
        fontFamily: CUSTOM_MARKETING_DEFAULT_FONT_FAMILY,
        fontSize: CUSTOM_MARKETING_DEFAULT_FONT_SIZE,
        color: CUSTOM_MARKETING_DEFAULT_TEXT_COLOR
      }, false)
    },
    onUpdate: ({ editor: current }) => {
      options.model.value = current.getHTML()
    },
    onSelectionUpdate: ({ editor: current }) => {
      selectionTick.value += 1
      if (applyingToolbarMarks.value) return
      if (current.state.selection.empty) {
        // Skip mark sync on empty list rows so Enter can create visible new bullets.
        const inEmptyListRow =
          current.isActive('listItem') && current.state.selection.$from.parent.content.size === 0
        if (!inEmptyListRow) applyToolbarTextStyleMarks(current, false)
        return
      }
      syncToolbarFromSelection(current)
    },
    onTransaction: () => {
      selectionTick.value += 1
    }
  })

  function toolbarTextStyleAttrs(): CustomMarketingTextStyleAttrs {
    return {
      fontFamily: selectedFontFamily.value,
      fontSize: selectedFontSize.value,
      color: selectedColor.value
    }
  }

  function applyTextStyleMark(
    target: CoreEditor,
    attrs: CustomMarketingTextStyleAttrs,
    focusEditor: boolean
  ): void {
    if (textStyleAttrsMatch(target.getAttributes('textStyle'), attrs)) return
    applyingToolbarMarks.value = true
    try {
      if (focusEditor) target.view.focus()
      const markType = target.schema.marks.textStyle
      if (!markType) return
      const { state, view } = target
      const mark = markType.create(attrs)
      const tr = state.selection.empty
        ? state.tr.addStoredMark(mark)
        : state.tr.addMark(state.selection.from, state.selection.to, mark)
      view.dispatch(tr)
    } finally {
      applyingToolbarMarks.value = false
    }
  }

  function applyToolbarTextStyleMarks(target?: CoreEditor | null, focusEditor = true): void {
    const current = target ?? editor.value
    if (!current) return
    applyTextStyleMark(current, toolbarTextStyleAttrs(), focusEditor)
  }

  function syncToolbarFromSelection(target?: CoreEditor | null): void {
    const current = target ?? editor.value
    if (!current) return
    const attrs = current.getAttributes('textStyle')
    selectedFontFamily.value =
      typeof attrs.fontFamily === 'string' && attrs.fontFamily
        ? attrs.fontFamily
        : CUSTOM_MARKETING_DEFAULT_FONT_FAMILY
    selectedFontSize.value =
      typeof attrs.fontSize === 'string' && attrs.fontSize
        ? attrs.fontSize
        : CUSTOM_MARKETING_DEFAULT_FONT_SIZE
    selectedColor.value =
      typeof attrs.color === 'string' && attrs.color
        ? attrs.color
        : CUSTOM_MARKETING_DEFAULT_TEXT_COLOR
    const highlight = current.getAttributes('highlight').color
    if (typeof highlight === 'string' && highlight) selectedHighlight.value = highlight
  }

  watch(
    () => options.model.value,
    (html) => {
      const current = editor.value
      if (!current) return
      if (html === current.getHTML()) return
      current.commands.setContent(html || '<p></p>', { emitUpdate: false })
    }
  )

  function tickActive<T>(check: () => T): T {
    void selectionTick.value
    return check()
  }

  const isBold = computed(() => tickActive(() => editor.value?.isActive('bold') ?? false))
  const isItalic = computed(() => tickActive(() => editor.value?.isActive('italic') ?? false))
  const isUnderline = computed(() => tickActive(() => editor.value?.isActive('underline') ?? false))
  const isStrike = computed(() => tickActive(() => editor.value?.isActive('strike') ?? false))
  const isSubscript = computed(() => tickActive(() => editor.value?.isActive('subscript') ?? false))
  const isSuperscript = computed(() => tickActive(() => editor.value?.isActive('superscript') ?? false))
  const isBulletList = computed(() => tickActive(() => editor.value?.isActive('bulletList') ?? false))
  const isOrderedList = computed(() => tickActive(() => editor.value?.isActive('orderedList') ?? false))
  const isImageSelected = computed(() => tickActive(() => editor.value?.isActive('image') ?? false))
  const isInTwoColumns = computed(() =>
    tickActive(
      () =>
        editor.value?.isActive('customMarketingColumns')
        || editor.value?.isActive('customMarketingColumn')
        || false
    )
  )
  const selectedImageWidth = computed((): number | null => {
    void selectionTick.value
    const width = editor.value?.getAttributes('image').width
    return typeof width === 'number' && width > 0 ? width : null
  })
  const isAlignLeft = computed(() =>
    tickActive(() => {
      if (editor.value?.isActive('image')) {
        return normalizeCustomMarketingImageAlign(editor.value.getAttributes('image').textAlign) === 'left'
      }
      return editor.value?.isActive({ textAlign: 'left' }) ?? false
    })
  )
  const isAlignCenter = computed(() =>
    tickActive(() => {
      if (editor.value?.isActive('image')) {
        return normalizeCustomMarketingImageAlign(editor.value.getAttributes('image').textAlign) === 'center'
      }
      return editor.value?.isActive({ textAlign: 'center' }) ?? false
    })
  )
  const isAlignRight = computed(() =>
    tickActive(() => {
      if (editor.value?.isActive('image')) {
        return normalizeCustomMarketingImageAlign(editor.value.getAttributes('image').textAlign) === 'right'
      }
      return editor.value?.isActive({ textAlign: 'right' }) ?? false
    })
  )
  const isAlignJustify = computed(() =>
    tickActive(() => {
      if (editor.value?.isActive('image')) return false
      return editor.value?.isActive({ textAlign: 'justify' }) ?? false
    })
  )
  const canUndo = computed(() => tickActive(() => editor.value?.can().undo() ?? false))
  const canRedo = computed(() => tickActive(() => editor.value?.can().redo() ?? false))

  function applyFontFamily(value: string): void {
    selectedFontFamily.value = value
    applyToolbarTextStyleMarks(editor.value, true)
  }

  function applyFontSize(value: string): void {
    selectedFontSize.value = value
    applyToolbarTextStyleMarks(editor.value, true)
  }

  function applyColor(value: string): void {
    selectedColor.value = value
    applyToolbarTextStyleMarks(editor.value, true)
  }

  function applyHighlight(value: string): void {
    selectedHighlight.value = value
    editor.value?.chain().focus().toggleHighlight({ color: value }).run()
  }

  function clearHighlight(): void {
    editor.value?.chain().focus().unsetHighlight().run()
  }

  function toggleBold(): void {
    editor.value?.chain().focus().toggleBold().run()
  }

  function toggleItalic(): void {
    editor.value?.chain().focus().toggleItalic().run()
  }

  function toggleUnderline(): void {
    editor.value?.chain().focus().toggleUnderline().run()
  }

  function toggleStrike(): void {
    editor.value?.chain().focus().toggleStrike().run()
  }

  function toggleSubscript(): void {
    editor.value?.chain().focus().toggleSubscript().run()
  }

  function toggleSuperscript(): void {
    editor.value?.chain().focus().toggleSuperscript().run()
  }

  function toggleBulletList(): void {
    editor.value?.chain().focus().toggleBulletList().run()
  }

  function toggleOrderedList(): void {
    editor.value?.chain().focus().toggleOrderedList().run()
  }

  function setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
    const current = editor.value
    if (!current) return
    const command = customMarketingAlignCommandValue(align, current.isActive('image'))
    if (command.target === 'image') {
      const pos = current.state.selection.from
      // Keep NodeSelection — plain focus() can drop the image selection before updateAttributes.
      current.chain().setNodeSelection(pos).updateAttributes('image', {
        textAlign: command.align
      }).run()
      return
    }
    current.chain().focus().setTextAlign(align).run()
  }

  function indent(): void {
    editor.value?.chain().focus().indentParagraph().run()
  }

  function outdent(): void {
    editor.value?.chain().focus().outdentParagraph().run()
  }

  function undo(): void {
    editor.value?.chain().focus().undo().run()
  }

  function redo(): void {
    editor.value?.chain().focus().redo().run()
  }

  function clearFormatting(): void {
    selectedFontFamily.value = CUSTOM_MARKETING_DEFAULT_FONT_FAMILY
    selectedFontSize.value = CUSTOM_MARKETING_DEFAULT_FONT_SIZE
    selectedColor.value = CUSTOM_MARKETING_DEFAULT_TEXT_COLOR
    editor.value?.chain().focus().clearNodes().unsetAllMarks().run()
    applyToolbarTextStyleMarks(editor.value, true)
  }

  function openImagePicker(): void {
    if (imageUploading.value) return
    imageInputRef.value?.click()
  }

  async function onImageFileChange(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !editor.value) return
    try {
      await insertImageWithLoader(file, 'Could not insert image')
    } finally {
      input.value = ''
    }
  }

  function setImageWidthPreset(width: CustomMarketingImageWidthPreset): void {
    const current = editor.value
    if (!current?.isActive('image')) return
    if (width == null) {
      current.chain().focus().updateAttributes('image', { width: null, height: null }).run()
      return
    }
    current.chain().focus().updateAttributes('image', { width, height: null }).run()
  }

  function deleteSelectedImage(): void {
    const current = editor.value
    if (!current?.isActive('image')) return
    current.chain().focus().deleteSelection().run()
  }

  function insertTwoColumns(): void {
    editor.value?.chain().focus().insertCustomMarketingTwoColumns().run()
  }

  function deleteTwoColumns(): void {
    editor.value?.chain().focus().deleteCustomMarketingTwoColumns().run()
  }

  function toolbarBtnClass(active: boolean): string {
    return active
      ? 'custom-marketing-editor__btn custom-marketing-editor__btn--active'
      : 'custom-marketing-editor__btn'
  }

  onBeforeUnmount(() => {
    editor.value?.destroy()
  })

  return {
    editor,
    EditorContent,
    fontFamilies: CUSTOM_MARKETING_FONT_FAMILIES,
    fontSizes: CUSTOM_MARKETING_FONT_SIZES,
    imageWidthPresets: CUSTOM_MARKETING_IMAGE_WIDTH_PRESETS,
    selectedFontFamily,
    selectedFontSize,
    selectedColor,
    selectedHighlight,
    imageInputRef,
    imageError,
    imageUploading,
    isImageSelected,
    isInTwoColumns,
    selectedImageWidth,
    gmailClipWarning,
    isBold,
    isItalic,
    isUnderline,
    isStrike,
    isSubscript,
    isSuperscript,
    isBulletList,
    isOrderedList,
    isAlignLeft,
    isAlignCenter,
    isAlignRight,
    isAlignJustify,
    canUndo,
    canRedo,
    applyFontFamily,
    applyFontSize,
    applyColor,
    applyHighlight,
    clearHighlight,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    toggleSubscript,
    toggleSuperscript,
    toggleBulletList,
    toggleOrderedList,
    setAlign,
    indent,
    outdent,
    undo,
    redo,
    clearFormatting,
    openImagePicker,
    onImageFileChange,
    setImageWidthPreset,
    deleteSelectedImage,
    insertTwoColumns,
    deleteTwoColumns,
    toolbarBtnClass
  }
}
