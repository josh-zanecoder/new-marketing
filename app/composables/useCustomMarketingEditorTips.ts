import type { Component } from 'vue'
import { Braces, Columns2, Eye, Image as ImageIcon } from 'lucide-vue-next'
import {
  CUSTOM_MARKETING_EDITOR_TIPS,
  CUSTOM_MARKETING_EDITOR_TIPS_HEADING,
  type CustomMarketingEditorTipDef
} from '~~/shared/customMarketingEditorTips'

export type CustomMarketingEditorTipView = CustomMarketingEditorTipDef & {
  icon: Component
}

const TIP_ICONS: Record<string, Component> = {
  preview: Eye,
  variables: Braces,
  photos: ImageIcon,
  layout: Columns2
}

export type CustomMarketingEditorTipsBinders = {
  heading: string
  tips: CustomMarketingEditorTipView[]
}

/** Presentational binders for the write-message tips panel. */
export function useCustomMarketingEditorTips(): CustomMarketingEditorTipsBinders {
  const tips = CUSTOM_MARKETING_EDITOR_TIPS.map((tip) => ({
    ...tip,
    icon: TIP_ICONS[tip.id] ?? Eye
  }))
  return { heading: CUSTOM_MARKETING_EDITOR_TIPS_HEADING, tips }
}
