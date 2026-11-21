/**
 * Optional tips through Google Play Billing. Disabled in sideloaded test builds: the billing
 * plugin is added back when the app goes to Google Play (see docs/HANDOFF.md).
 */
export const TIP_PRODUCTS = ['tip_small', 'tip_medium', 'tip_large'] as const
export type TipId = (typeof TIP_PRODUCTS)[number]

export interface TipOffer {
  id: TipId
  price: string
}

export function tipsAvailable(): boolean {
  return false
}

export async function loadTips(): Promise<TipOffer[]> {
  return []
}

export async function tip(_id: TipId): Promise<void> {
  throw new Error('Tips are not available in this version.')
}
