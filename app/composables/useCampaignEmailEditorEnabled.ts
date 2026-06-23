/** GrapesJS campaign email editor — see `runtimeConfig.public.campaignEmailEditorEnabled`. */
export function useCampaignEmailEditorEnabled() {
  const config = useRuntimeConfig()
  return computed(() => {
    const flag = config.public.campaignEmailEditorEnabled
    if (flag === true) return true
    if (flag === false) return false
    // Enabled in `nuxt dev` when env flag is unset (production builds stay off).
    return import.meta.dev
  })
}
