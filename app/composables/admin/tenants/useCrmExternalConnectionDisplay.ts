import type { CrmExternalConnectionMetadata } from '~~/shared/types/crmExternalConnection'

export function formatCrmExternalConnectionJson(metadata: CrmExternalConnectionMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`
}

export function useCrmExternalConnectionDisplay(metadata: Ref<CrmExternalConnectionMetadata | null>) {
  const jsonText = computed(() => (metadata.value ? formatCrmExternalConnectionJson(metadata.value) : ''))

  return { jsonText }
}
