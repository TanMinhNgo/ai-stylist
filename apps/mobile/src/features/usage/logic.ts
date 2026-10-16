import { AccountDeletionResponse, type EntitlementsResponse, type SubscriptionFeature, type UsageResponse } from '@stylist/shared';

export const PLAN_LABEL = { free: 'Free', plus: 'Plus', pro: 'Pro' } as const;
// monthly_try_on_* omitted: quota numbers come from GET /usage, not catalog markers.
const FEATURE_LABEL: Partial<Record<SubscriptionFeature, string>> = {
  digital_wardrobe: 'Tủ đồ số', ai_styling: 'Tư vấn phối đồ AI', personal_lookbook: 'Lookbook cá nhân',
  advanced_outfit_advice: 'Phân tích bộ phối chi tiết', accessory_recommendations: 'Gợi ý phụ kiện', occasion_collections: 'Bộ sưu tập theo dịp',
  weekly_outfit_planner: 'Kế hoạch trang phục tuần', wardrobe_insights: 'Phân tích tủ đồ', priority_queue: 'Ưu tiên hàng chờ',
};
/** Only availableFeatures count as usable; included-but-unavailable is shown as "sắp có", never unlocked. */
export function planBenefits(e: EntitlementsResponse) {
  const label = (f: SubscriptionFeature) => FEATURE_LABEL[f];
  return {
    available: e.availableFeatures.map(label).filter((l): l is string => !!l),
    upcoming: e.includedFeatures.filter((f) => !e.availableFeatures.includes(f)).map(label).filter((l): l is string => !!l),
  };
}
export const usageBlocked = (usage: UsageResponse | undefined) => !usage || usage.remaining === 0;
export const resetDelay = (usage: Pick<UsageResponse, 'resetsAt'> | undefined, now = Date.now()): number | false => usage ? Math.max(60_000, Math.min(Date.parse(usage.resetsAt) - now + 1000, 86_400_000)) : false;
export const resetLabel = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// Vietnamese keyboards may emit "xóa" lowercase or with a combining accent (NFD).
export const deletionConfirmed = (step: number, text: string) => step === 2 && text.trim().normalize('NFC').toUpperCase() === 'XÓA';
// Only "no network at all": the API may sit on the LAN, so internet reachability says nothing about it.
export const offline = (state: { isConnected?: boolean }) => state.isConnected === false;
export const DELETION_STATUS = { queued: 'đang chờ xử lý', processing: 'đang xóa', failed: 'tạm lỗi, máy chủ sẽ thử lại', completed: 'đã xóa xong' } as const;

/** DELETE is idempotent at the backend; a failed receipt must never sign out or claim deletion succeeded. */
export async function deleteThenSignOut(remove: () => Promise<unknown>, accepted: (receipt: AccountDeletionResponse) => void, signOut: () => Promise<void>) {
  const receipt = AccountDeletionResponse.parse(await remove());
  accepted(receipt);
  await signOut();
  return receipt;
}
