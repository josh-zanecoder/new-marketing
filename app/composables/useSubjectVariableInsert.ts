import type { Ref } from 'vue'
import { nextTick, ref, watch } from 'vue'
import { insertAtTextCursor } from '~/utils/insertAtTextCursor'

/** Insert merge tokens into a subject field at the last known caret position. */
export function useSubjectVariableInsert(subject: Ref<string>) {
  const subjectVariable = ref('')
  const subjectInputRef = ref<HTMLInputElement | null>(null)
  const subjectCaret = ref({ start: 0, end: 0 })

  function syncSubjectCaret() {
    const el = subjectInputRef.value
    if (!el) return
    const start = el.selectionStart ?? subject.value.length
    const end = el.selectionEnd ?? start
    subjectCaret.value = { start, end }
  }

  function insertSubjectVariable(token: string) {
    const { start, end } = subjectCaret.value
    const { text, cursor } = insertAtTextCursor(subject.value, token, start, end)
    subject.value = text
    subjectCaret.value = { start: cursor, end: cursor }
    nextTick(() => {
      const el = subjectInputRef.value
      if (!el) return
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  watch(subjectVariable, (val) => {
    if (!val) return
    insertSubjectVariable(val)
    subjectVariable.value = ''
  })

  return { subjectVariable, subjectInputRef, syncSubjectCaret }
}
