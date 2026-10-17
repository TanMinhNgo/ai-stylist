// RevenueCat native SDK. It only talks to the store; the API decides the plan (POST /billing/sync afterwards).
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
/** This build has a public store key; without it the app only links to store management. */
export const storeReady = !!KEY;

let configured = false;
let current: string | null = null;

/** Always the appUserId from GET /billing/session, set before any purchase or restore. */
async function asUser(appUserId: string) {
  if (!KEY) throw new Error('Bản app này chưa được cấu hình để mua gói.');
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: appUserId });
    configured = true;
  } else if (current !== appUserId) await Purchases.logIn(appUserId);
  current = appUserId;
}

export async function storePackages(appUserId: string): Promise<PurchasesPackage[]> {
  await asUser(appUserId);
  return (await Purchases.getOfferings()).current?.availablePackages ?? [];
}

/** false when the user cancelled in the store sheet. */
export async function buyPackage(appUserId: string, pkg: PurchasesPackage) {
  await asUser(appUserId);
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(appUserId: string) {
  await asUser(appUserId);
  await Purchases.restorePurchases();
}

/** Sign-out or account switch: the next account never inherits this store identity. */
export async function forgetStoreUser() {
  if (!configured || !current) return;
  current = null;
  await Purchases.logOut().catch(() => {});
}
