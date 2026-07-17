import { computed, onMounted, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import type { Editor } from '@tiptap/core'
import type { TenantDynamicVariableItem } from '~/composables/useTenantMarketingApi'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'
import {
  customMarketingMergeToken,
  groupCustomMarketingMergeVariables,
  resolveCustomMarketingMergeVariables,
  type CustomMarketingMergeVariable
} from '~~/shared/customMarketingMergeVariables'

export type CustomMarketingVariablePickerBinders = {
  variablePickerOpen: Ref<boolean>
  variablesPending: Ref<boolean>
  variablesError: Ref<string>
  bodyVariables: ComputedRef<CustomMarketingMergeVariable[]>
  groupedBodyVariables: ComputedRef<ReturnType<typeof groupCustomMarketingMergeVariables>>
  hasBodyVariables: ComputedRef<boolean>
  toggleVariablePicker: () => void
  closeVariablePicker: () => void
  insertMergeVariable: (variable: CustomMarketingMergeVariable) => void
  tokenFor: (variable: CustomMarketingMergeVariable) => string
}

/** Loads tenant merge variables and inserts `{{key}}` at the TipTap caret. */
export function useCustomMarketingVariablePicker(options: {
  editor: { readonly value: Editor | null | undefined }
}): CustomMarketingVariablePickerBinders {
  const marketingApi = useTenantMarketingApi()
  const apiVariables = ref<TenantDynamicVariableItem[]>([])
  const variablesPending = ref(false)
  const variablesError = ref('')
  const variablePickerOpen = ref(false)
  const loaded = ref(false)

  const bodyVariables = computed(() =>
    resolveCustomMarketingMergeVariables(apiVariables.value, 'body')
  )
  const groupedBodyVariables = computed(() =>
    groupCustomMarketingMergeVariables(bodyVariables.value)
  )
  const hasBodyVariables = computed(() => bodyVariables.value.length > 0)

  function tokenFor(variable: CustomMarketingMergeVariable): string {
    return customMarketingMergeToken(variable.key)
  }

  async function loadVariables(): Promise<void> {
    if (loaded.value || variablesPending.value) return
    variablesPending.value = true
    variablesError.value = ''
    try {
      const res = await marketingApi.fetchDynamicVariables()
      apiVariables.value = Array.isArray(res.variables) ? res.variables : []
      loaded.value = true
    } catch {
      apiVariables.value = []
      variablesError.value = 'Could not load variables.'
      loaded.value = true
    } finally {
      variablesPending.value = false
    }
  }

  function closeVariablePicker(): void {
    variablePickerOpen.value = false
  }

  function toggleVariablePicker(): void {
    variablePickerOpen.value = !variablePickerOpen.value
    if (variablePickerOpen.value) void loadVariables()
  }

  function insertMergeVariable(variable: CustomMarketingMergeVariable): void {
    const token = tokenFor(variable)
    if (!token) return
    const current = options.editor.value
    if (!current) return
    current.chain().focus().insertContent(token).run()
    closeVariablePicker()
  }

  function onDocumentPointerDown(event: MouseEvent): void {
    if (!variablePickerOpen.value) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-custom-marketing-variable-picker]')) return
    closeVariablePicker()
  }

  onMounted(() => {
    void loadVariables()
    document.addEventListener('pointerdown', onDocumentPointerDown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown)
  })

  return {
    variablePickerOpen,
    variablesPending,
    variablesError,
    bodyVariables,
    groupedBodyVariables,
    hasBodyVariables,
    toggleVariablePicker,
    closeVariablePicker,
    insertMergeVariable,
    tokenFor
  }
}
