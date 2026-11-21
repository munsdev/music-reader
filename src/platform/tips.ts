import { Capacitor } from '@capacitor/core'
import 'cordova-plugin-purchase'

/**
 * Optional tips through Google Play Billing (consumable products). No feature depends on
 * tipping. Product ids must match the ones created in Play Console.
 */
export const TIP_PRODUCTS = ['tip_small', 'tip_medium', 'tip_large'] as const
export type TipId = (typeof TIP_PRODUCTS)[number]

export interface TipOffer {
  id: TipId
  price: string
}

let ready: Promise<boolean> | null = null

function store() {
  return (window as unknown as { CdvPurchase?: typeof CdvPurchase }).CdvPurchase
}

export function tipsAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && !!store()
}

function init(): Promise<boolean> {
  ready ??= new Promise((resolve) => {
    const P = store()
    if (!P || Capacitor.getPlatform() !== 'android') return resolve(false)
    const s = P.store
    s.register(
      TIP_PRODUCTS.map((id) => ({
        id,
        type: P.ProductType.CONSUMABLE,
        platform: P.Platform.GOOGLE_PLAY,
      })),
    )
    s.when().approved((t) => t.finish())
    s.initialize([P.Platform.GOOGLE_PLAY]).then(
      () => resolve(true),
      () => resolve(false),
    )
  })
  return ready
}

export async function loadTips(): Promise<TipOffer[]> {
  if (!(await init())) return []
  const P = store()!
  return TIP_PRODUCTS.flatMap((id) => {
    const offer = P.store.get(id, P.Platform.GOOGLE_PLAY)?.getOffer()
    const price = offer?.pricingPhases[0]?.price
    return offer && price ? [{ id, price }] : []
  })
}

export async function tip(id: TipId): Promise<void> {
  if (!(await init())) throw new Error('Tips are not available on this device.')
  const P = store()!
  const offer = P.store.get(id, P.Platform.GOOGLE_PLAY)?.getOffer()
  if (!offer) throw new Error('This tip is not available right now.')
  const err = await offer.order()
  if (err && err.code !== P.ErrorCode.PAYMENT_CANCELLED) throw new Error(err.message)
}
