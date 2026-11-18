import { resolveMarketingFlyersAccess } from '~~/shared/utils/marketingFlyersAccess'

/**
 * CRM handoff permission gates for the Marketing Flyers tab.
 * Firebase / legacy sessions without a permission snapshot keep full access.
 */
export function useMarketingFlyersPermissions() {
  const { data: me } = useMarketingMe()

  const access = computed(() =>
    resolveMarketingFlyersAccess({
      hasCrmPermissionSnapshot: me.value?.authType === 'apiKey',
      permissions: me.value?.authType === 'apiKey' ? me.value.permissions : undefined,
    })
  )

  return {
    canReadFlyers: computed(() => access.value.canReadFlyers),
    canAddFlyers: computed(() => access.value.canAddFlyers),
    canDeleteFlyers: computed(() => access.value.canDeleteFlyers),
  }
}
