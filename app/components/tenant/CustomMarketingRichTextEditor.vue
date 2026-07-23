<script setup lang="ts">
import { computed } from 'vue'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Columns2,
  Eye,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Eraser,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  X
} from 'lucide-vue-next'
import { useCustomMarketingEmailPreviewChrome } from '~/composables/useCustomMarketingEmailPreviewChrome'
import { useCustomMarketingMessagePreview } from '~/composables/useCustomMarketingMessagePreview'
import { useCustomMarketingPreviewMerge } from '~/composables/useCustomMarketingPreviewMerge'
import { useCustomMarketingRichTextEditor } from '~/composables/useCustomMarketingRichTextEditor'
import { useCustomMarketingVariablePicker } from '~/composables/useCustomMarketingVariablePicker'
import '~/assets/css/custom-marketing-editor.css'

const props = withDefaults(
  defineProps<{
    subject?: string
    fromName?: string
    fromEmail?: string
    toEmail?: string
    recipientListId?: string
  }>(),
  {
    subject: '',
    fromName: '',
    fromEmail: '',
    toEmail: '',
    recipientListId: ''
  }
)

const model = defineModel<string>({ required: true })

const subjectRef = computed(() => props.subject)
const fromNameRef = computed(() => props.fromName)
const fromEmailRef = computed(() => props.fromEmail)
const toEmailRef = computed(() => props.toEmail)
const recipientListIdRef = computed(() => props.recipientListId)
const bodyHtmlRef = computed(() => model.value ?? '')

const { previewOpen, openPreview, closePreview } = useCustomMarketingMessagePreview()

const { previewSubject, previewBodyHtml } = useCustomMarketingPreviewMerge({
  previewOpen,
  recipientListId: recipientListIdRef,
  subject: subjectRef,
  bodyHtml: bodyHtmlRef
})

const {
  subjectDisplay,
  fromNameDisplay,
  fromEmailDisplay,
  toDisplay,
  senderInitials,
  dateLabel,
  browserAddressUrl,
  browserTabLabel
} = useCustomMarketingEmailPreviewChrome({
  subject: previewSubject,
  fromName: fromNameRef,
  fromEmail: fromEmailRef,
  toEmail: toEmailRef
})

const {
  editor,
  EditorContent,
  fontFamilies,
  fontSizes,
  imageWidthPresets,
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
  insertTwoColumns,
  toolbarBtnClass
} = useCustomMarketingRichTextEditor({ model, recipientListId: recipientListIdRef })

const {
  variablePickerOpen,
  variablesPending,
  variablesError,
  groupedBodyVariables,
  hasBodyVariables,
  toggleVariablePicker,
  insertMergeVariable,
  tokenFor
} = useCustomMarketingVariablePicker({ editor })
</script>

<template>
  <div class="custom-marketing-editor__shell">
    <div class="custom-marketing-editor__shell-top">
      <button
        type="button"
        class="custom-marketing-editor__preview-btn"
        data-tip="Preview as Gmail"
        aria-label="Preview as Gmail"
        @click="openPreview"
      >
        <Eye :size="15" :stroke-width="2" />
        <span>Preview</span>
      </button>
    </div>
    <div class="custom-marketing-editor__ribbon" role="toolbar" aria-label="Message formatting">
      <div class="custom-marketing-editor__ribbon-row">
        <div class="custom-marketing-editor__group">
          <div class="custom-marketing-editor__group-controls">
            <span class="custom-marketing-editor__tip" data-tip="Undo">
              <button type="button" :class="toolbarBtnClass(false)" :disabled="!canUndo" aria-label="Undo" @mousedown.prevent @click="undo">
                <Undo2 :size="15" :stroke-width="2" />
              </button>
            </span>
            <span class="custom-marketing-editor__tip" data-tip="Redo">
              <button type="button" :class="toolbarBtnClass(false)" :disabled="!canRedo" aria-label="Redo" @mousedown.prevent @click="redo">
                <Redo2 :size="15" :stroke-width="2" />
              </button>
            </span>
          </div>
          <span class="custom-marketing-editor__group-label">History</span>
        </div>

        <div class="custom-marketing-editor__group">
          <div class="custom-marketing-editor__group-controls">
            <span class="custom-marketing-editor__tip" data-tip="Font family">
              <select
                class="custom-marketing-editor__select custom-marketing-editor__select--font"
                :value="selectedFontFamily"
                aria-label="Font family"
                @change="applyFontFamily(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="font in fontFamilies" :key="font.value" :value="font.value" :style="{ fontFamily: font.value }">
                  {{ font.label }}
                </option>
              </select>
            </span>
            <span class="custom-marketing-editor__tip" data-tip="Font size">
              <select
                class="custom-marketing-editor__select custom-marketing-editor__select--size"
                :value="selectedFontSize"
                aria-label="Font size"
                @change="applyFontSize(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="size in fontSizes" :key="size.value" :value="size.value">
                  {{ size.label }}
                </option>
              </select>
            </span>
          </div>
          <span class="custom-marketing-editor__group-label">Font</span>
        </div>

        <div class="custom-marketing-editor__group">
          <div class="custom-marketing-editor__group-controls">
            <button type="button" :class="toolbarBtnClass(isBold)" data-tip="Bold" aria-label="Bold" @mousedown.prevent @click="toggleBold">
              <Bold :size="15" :stroke-width="2.5" />
            </button>
            <button type="button" :class="toolbarBtnClass(isItalic)" data-tip="Italic" aria-label="Italic" @mousedown.prevent @click="toggleItalic">
              <Italic :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isUnderline)" data-tip="Underline" aria-label="Underline" @mousedown.prevent @click="toggleUnderline">
              <Underline :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isStrike)" data-tip="Strikethrough" aria-label="Strikethrough" @mousedown.prevent @click="toggleStrike">
              <Strikethrough :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isSubscript)" data-tip="Subscript" aria-label="Subscript" @mousedown.prevent @click="toggleSubscript">
              <Subscript :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isSuperscript)" data-tip="Superscript" aria-label="Superscript" @mousedown.prevent @click="toggleSuperscript">
              <Superscript :size="15" :stroke-width="2" />
            </button>
            <label class="custom-marketing-editor__color-wrap" data-tip="Text color">
              <span aria-hidden="true" style="font-size: 12px; font-weight: 700; line-height: 1;">A</span>
              <span class="custom-marketing-editor__color-swatch" :style="{ background: selectedColor }" />
              <input
                class="custom-marketing-editor__color-input"
                type="color"
                :value="selectedColor"
                aria-label="Text color"
                @input="applyColor(($event.target as HTMLInputElement).value)"
              >
            </label>
            <label class="custom-marketing-editor__color-wrap" data-tip="Highlight color">
              <Highlighter :size="14" :stroke-width="2" />
              <span class="custom-marketing-editor__color-swatch" :style="{ background: selectedHighlight }" />
              <input
                class="custom-marketing-editor__color-input"
                type="color"
                :value="selectedHighlight"
                aria-label="Highlight color"
                @input="applyHighlight(($event.target as HTMLInputElement).value)"
              >
            </label>
            <button type="button" :class="toolbarBtnClass(false)" data-tip="Clear highlight" aria-label="Clear highlight" @mousedown.prevent @click="clearHighlight">
              <Eraser :size="14" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(false)" data-tip="Clear formatting" aria-label="Clear formatting" @mousedown.prevent @click="clearFormatting">
              <RemoveFormatting :size="14" :stroke-width="2" />
            </button>
          </div>
          <span class="custom-marketing-editor__group-label">Font style</span>
        </div>

        <div class="custom-marketing-editor__group">
          <div class="custom-marketing-editor__group-controls">
            <button type="button" :class="toolbarBtnClass(isBulletList)" data-tip="Bulleted list" aria-label="Bulleted list" @mousedown.prevent @click="toggleBulletList">
              <List :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isOrderedList)" data-tip="Numbered list" aria-label="Numbered list" @mousedown.prevent @click="toggleOrderedList">
              <ListOrdered :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(false)" data-tip="Decrease indent" aria-label="Decrease indent" @mousedown.prevent @click="outdent">
              <IndentDecrease :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(false)" data-tip="Increase indent" aria-label="Increase indent" @mousedown.prevent @click="indent">
              <IndentIncrease :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isAlignLeft)" :data-tip="isImageSelected ? 'Align left — type beside photo' : 'Align text left'" :aria-label="isImageSelected ? 'Align image left so text wraps beside it' : 'Align text left'" @mousedown.prevent @click="setAlign('left')">
              <AlignLeft :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isAlignCenter)" :data-tip="isImageSelected ? 'Align center — text below' : 'Align text center'" :aria-label="isImageSelected ? 'Align image center' : 'Align text center'" @mousedown.prevent @click="setAlign('center')">
              <AlignCenter :size="15" :stroke-width="2" />
            </button>
            <button type="button" :class="toolbarBtnClass(isAlignRight)" :data-tip="isImageSelected ? 'Align right — type beside photo' : 'Align text right'" :aria-label="isImageSelected ? 'Align image right so text wraps beside it' : 'Align text right'" @mousedown.prevent @click="setAlign('right')">
              <AlignRight :size="15" :stroke-width="2" />
            </button>
            <span class="custom-marketing-editor__tip" :data-tip="isImageSelected ? 'Justify (text only)' : 'Justify'">
              <button type="button" :class="toolbarBtnClass(isAlignJustify)" aria-label="Justify" :disabled="isImageSelected" @mousedown.prevent @click="setAlign('justify')">
                <AlignJustify :size="15" :stroke-width="2" />
              </button>
            </span>
          </div>
          <span class="custom-marketing-editor__group-label">Paragraph</span>
        </div>

        <div class="custom-marketing-editor__group">
          <div class="custom-marketing-editor__group-controls">
            <input
              ref="imageInputRef"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              class="sr-only"
              @change="onImageFileChange"
            >
            <span class="custom-marketing-editor__tip" :data-tip="imageUploading ? 'Uploading photo…' : 'Insert image'">
              <button
                type="button"
                :class="toolbarBtnClass(false)"
                aria-label="Insert image"
                :disabled="imageUploading"
                @mousedown.prevent
                @click="openImagePicker"
              >
                <ImageIcon :size="15" :stroke-width="2" />
              </button>
            </span>
            <button
              type="button"
              :class="toolbarBtnClass(isInTwoColumns)"
              data-tip="Two columns — image beside text"
              aria-label="Insert two columns"
              @mousedown.prevent
              @click="insertTwoColumns"
            >
              <Columns2 :size="15" :stroke-width="2" />
            </button>
            <div class="custom-marketing-editor__variable-wrap" data-custom-marketing-variable-picker>
              <button
                type="button"
                :class="toolbarBtnClass(variablePickerOpen)"
                data-tip="Insert variable"
                aria-label="Insert variable"
                aria-haspopup="listbox"
                :aria-expanded="variablePickerOpen"
                @mousedown.prevent
                @click="toggleVariablePicker"
              >
                <Braces :size="15" :stroke-width="2" />
              </button>
              <div
                v-if="variablePickerOpen"
                class="custom-marketing-editor__variable-menu"
                role="listbox"
                aria-label="Merge variables"
              >
                <p v-if="variablesPending" class="custom-marketing-editor__variable-empty">Loading variables…</p>
                <p v-else-if="variablesError && !hasBodyVariables" class="custom-marketing-editor__variable-empty">
                  {{ variablesError }}
                </p>
                <p v-else-if="!hasBodyVariables" class="custom-marketing-editor__variable-empty">
                  No variables available.
                </p>
                <template v-else>
                  <div v-if="groupedBodyVariables.recipient.length" class="custom-marketing-editor__variable-group">
                    <p class="custom-marketing-editor__variable-group-label">Recipient</p>
                    <button
                      v-for="v in groupedBodyVariables.recipient"
                      :key="`recipient-${v.key}`"
                      type="button"
                      class="custom-marketing-editor__variable-item"
                      role="option"
                      @mousedown.prevent
                      @click="insertMergeVariable(v)"
                    >
                      <span class="custom-marketing-editor__variable-item-label">{{ v.label }}</span>
                      <span class="custom-marketing-editor__variable-item-token">{{ tokenFor(v) }}</span>
                    </button>
                  </div>
                  <div v-if="groupedBodyVariables.sender.length" class="custom-marketing-editor__variable-group">
                    <p class="custom-marketing-editor__variable-group-label">Sender</p>
                    <button
                      v-for="v in groupedBodyVariables.sender"
                      :key="`sender-${v.key}`"
                      type="button"
                      class="custom-marketing-editor__variable-item"
                      role="option"
                      @mousedown.prevent
                      @click="insertMergeVariable(v)"
                    >
                      <span class="custom-marketing-editor__variable-item-label">{{ v.label }}</span>
                      <span class="custom-marketing-editor__variable-item-token">{{ tokenFor(v) }}</span>
                    </button>
                  </div>
                  <div v-if="groupedBodyVariables.other.length" class="custom-marketing-editor__variable-group">
                    <p class="custom-marketing-editor__variable-group-label">Other</p>
                    <button
                      v-for="v in groupedBodyVariables.other"
                      :key="`other-${v.key}`"
                      type="button"
                      class="custom-marketing-editor__variable-item"
                      role="option"
                      @mousedown.prevent
                      @click="insertMergeVariable(v)"
                    >
                      <span class="custom-marketing-editor__variable-item-label">{{ v.label }}</span>
                      <span class="custom-marketing-editor__variable-item-token">{{ tokenFor(v) }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <span class="custom-marketing-editor__group-label">Insert</span>
        </div>
      </div>

      <div
        v-if="isImageSelected"
        class="custom-marketing-editor__image-toolbar"
        role="toolbar"
        aria-label="Image options"
      >
        <span class="custom-marketing-editor__image-toolbar-label">Image</span>
        <div class="custom-marketing-editor__image-size" role="group" aria-label="Image size">
          <button
            v-for="preset in imageWidthPresets"
            :key="preset.label"
            type="button"
            class="custom-marketing-editor__image-size-btn"
            :class="{
              'custom-marketing-editor__image-size-btn--active':
                preset.value == null
                  ? selectedImageWidth == null
                  : selectedImageWidth === preset.value
            }"
            :data-tip="preset.title"
            :aria-label="preset.title"
            @mousedown.prevent
            @click="setImageWidthPreset(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>
        <div class="custom-marketing-editor__image-toolbar-align" role="group" aria-label="Image align">
          <button type="button" :class="toolbarBtnClass(isAlignLeft)" data-tip="Align left — type beside photo" aria-label="Align image left so text wraps beside it" @mousedown.prevent @click="setAlign('left')">
            <AlignLeft :size="15" :stroke-width="2" />
          </button>
          <button type="button" :class="toolbarBtnClass(isAlignCenter)" data-tip="Align center — text below" aria-label="Align image center" @mousedown.prevent @click="setAlign('center')">
            <AlignCenter :size="15" :stroke-width="2" />
          </button>
          <button type="button" :class="toolbarBtnClass(isAlignRight)" data-tip="Align right — type beside photo" aria-label="Align image right so text wraps beside it" @mousedown.prevent @click="setAlign('right')">
            <AlignRight :size="15" :stroke-width="2" />
          </button>
        </div>
      </div>
    </div>

    <div class="custom-marketing-editor__compose" aria-label="Message editor">
      <div class="custom-marketing-editor__compose-body">
        <EditorContent v-if="editor" :editor="editor" />
        <div
          v-if="imageUploading"
          class="custom-marketing-editor__image-loader"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span class="custom-marketing-editor__image-loader-spinner" aria-hidden="true" />
          <span class="custom-marketing-editor__image-loader-text">Uploading photo…</span>
        </div>
      </div>
    </div>

    <p v-if="imageError" class="custom-marketing-editor__error">{{ imageError }}</p>
    <p v-if="gmailClipWarning" class="custom-marketing-editor__clip-warning" role="status">
      {{ gmailClipWarning }}
    </p>

    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="custom-marketing-editor__preview-modal"
        @click.self="closePreview"
      >
        <div
          class="custom-marketing-editor__preview-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Email preview"
        >
          <div class="custom-marketing-editor__preview-modal-bar">
            <div class="custom-marketing-editor__preview-modal-copy">
              <p class="custom-marketing-editor__preview-modal-title">Email preview</p>
              <p class="custom-marketing-editor__preview-modal-subtitle">
                Browser + Gmail view
              </p>
            </div>
            <button
              type="button"
              class="custom-marketing-editor__preview-modal-close"
              aria-label="Close preview"
              @click="closePreview"
            >
              <X :size="16" :stroke-width="2" />
              <span>Close</span>
            </button>
          </div>
          <div class="custom-marketing-editor__preview-modal-scroll">
            <div class="custom-marketing-editor__browser" aria-label="Browser email preview">
              <div class="custom-marketing-editor__browser-titlebar">
                <div class="custom-marketing-editor__browser-traffic" aria-hidden="true">
                  <span class="custom-marketing-editor__browser-dot custom-marketing-editor__browser-dot--red" />
                  <span class="custom-marketing-editor__browser-dot custom-marketing-editor__browser-dot--yellow" />
                  <span class="custom-marketing-editor__browser-dot custom-marketing-editor__browser-dot--green" />
                </div>
                <div class="custom-marketing-editor__browser-tab">
                  <span class="custom-marketing-editor__browser-tab-favicon" aria-hidden="true">M</span>
                  <span class="custom-marketing-editor__browser-tab-label">{{ browserTabLabel }}</span>
                </div>
              </div>
              <div class="custom-marketing-editor__browser-toolbar">
                <div class="custom-marketing-editor__browser-nav" aria-hidden="true">
                  <span class="custom-marketing-editor__browser-nav-btn">‹</span>
                  <span class="custom-marketing-editor__browser-nav-btn">›</span>
                  <span class="custom-marketing-editor__browser-nav-btn">↻</span>
                </div>
                <div class="custom-marketing-editor__browser-address">
                  <span class="custom-marketing-editor__browser-lock" aria-hidden="true" />
                  <span class="custom-marketing-editor__browser-url">{{ browserAddressUrl }}</span>
                </div>
              </div>
              <div class="custom-marketing-editor__inbox">
                <div class="custom-marketing-editor__inbox-header">
                  <h2 class="custom-marketing-editor__inbox-subject">{{ subjectDisplay }}</h2>
                  <div class="custom-marketing-editor__inbox-meta">
                    <div class="custom-marketing-editor__inbox-avatar" aria-hidden="true">{{ senderInitials }}</div>
                    <div class="custom-marketing-editor__inbox-meta-main">
                      <div class="custom-marketing-editor__inbox-from-row">
                        <div>
                          <span class="custom-marketing-editor__inbox-from-name">{{ fromNameDisplay }}</span>
                          <span v-if="fromEmailDisplay" class="custom-marketing-editor__inbox-from-email">&lt;{{ fromEmailDisplay }}&gt;</span>
                        </div>
                        <span class="custom-marketing-editor__inbox-date">{{ dateLabel }}</span>
                      </div>
                      <p class="custom-marketing-editor__inbox-to">
                        to <strong>{{ toDisplay }}</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <!-- eslint-disable vue/no-v-html -- intentional HTML email preview -->
                <div
                  class="custom-marketing-editor__inbox-body custom-marketing-editor__content custom-marketing-editor__preview-body"
                  v-html="previewBodyHtml"
                />
                <!-- eslint-enable vue/no-v-html -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
