import { CAMPAIGN_RECONCILE_GATE_SKIP_LOG } from '../../constants/campaignReconcile'

let reconcileBusy = false

/**
 * In-process mutex so Sending + Schedule reconcile never run at the same time
 * on one Cloud Run instance (they share the Mongo pool with webhooks).
 */
export async function withCampaignReconcileGate<T>(
  label: string,
  run: () => Promise<T>
): Promise<T | undefined> {
  if (reconcileBusy) {
    console.log(`[${label}] ${CAMPAIGN_RECONCILE_GATE_SKIP_LOG}`)
    return undefined
  }
  reconcileBusy = true
  try {
    return await run()
  } finally {
    reconcileBusy = false
  }
}

/** Test helper — reset between cases. */
export function resetCampaignReconcileGateForTests(): void {
  reconcileBusy = false
}
