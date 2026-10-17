import { useQuery } from '@tanstack/react-query';
import { Alert, Linking, Platform, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useBillingSession, useBillingSync } from '@/features/integrations/hooks';
import { manageUrl } from '@/features/integrations/logic';
import { buyPackage, restorePurchases, storePackages, storeReady } from '@/features/integrations/store';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, space } from '@/theme';

// RevenueCat rejects with plain objects carrying a readable message; API failures go through messageFor.
const storeError = (e: unknown) => {
  const message = (e as { message?: unknown } | null)?.message;
  return e instanceof RequestError || typeof message !== 'string' ? messageFor(e) : message;
};

/** Buy / restore through the store, then let the server verify. Prices come from the store, never hardcoded. */
export function StorePlans() {
  const session = useBillingSession();
  const sync = useBillingSync();
  const s = session.data;
  const appUserId = s?.enabled && s.purchaseAndRestore === 'native_sdk' && storeReady ? s.appUserId : null;
  const packages = useQuery({ queryKey: ['store-packages', appUserId], queryFn: () => storePackages(appUserId!), enabled: !!appUserId, retry: false });
  const manage = manageUrl(s?.managementUrls, Platform.OS);
  if (!s || (!appUserId && !manage)) return null;

  const afterStore = () =>
    sync.mutate(undefined, {
      onSuccess: ({ plan }) => Alert.alert('Đã cập nhật gói', plan === 'free' ? 'Máy chủ chưa thấy gói trả phí còn hiệu lực.' : 'Quyền lợi gói đã được làm mới.'),
      onError: (e) => Alert.alert('Chưa xác minh được gói', `${messageFor(e)} Bạn có thể bấm "Khôi phục giao dịch" để thử lại.`),
    });
  const run = async (action: () => Promise<boolean | void>) => {
    try {
      if ((await action()) !== false) afterStore();
    } catch (e) {
      Alert.alert('Cửa hàng chưa xử lý được', storeError(e));
    }
  };

  return (
    <Card>
      <Text variant="headline">Nâng cấp gói</Text>
      {appUserId ? (
        packages.isPending ? (
          <Text variant="callout" color={colors.inkSecondary}>Đang tải giá từ cửa hàng…</Text>
        ) : packages.isError ? (
          <Text variant="callout" color={colors.danger}>{storeError(packages.error)}</Text>
        ) : packages.data.length ? (
          packages.data.map((p) => (
            <View key={p.identifier} style={{ gap: space.xs }}>
              <Text variant="body" style={{ fontWeight: '600' }}>{p.product.title}</Text>
              <Text variant="caption" color={colors.inkSecondary}>{p.product.description}</Text>
              <Button label={`Mua ${p.product.priceString}`} onPress={() => run(() => buyPackage(appUserId, p))} loading={sync.isPending} />
            </View>
          ))
        ) : (
          <Text variant="callout" color={colors.inkSecondary}>Cửa hàng chưa có gói nào để mua.</Text>
        )
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Mua gói trong app chưa mở. Gói hiện có vẫn quản lý được ở cửa hàng.</Text>
      )}
      {appUserId ? <Button label="Khôi phục giao dịch" variant="plain" onPress={() => run(() => restorePurchases(appUserId))} disabled={sync.isPending} /> : null}
      {manage ? <Button label="Quản lý hoặc hủy gói" variant="plain" onPress={() => void Linking.openURL(manage)} /> : null}
    </Card>
  );
}

/** Deleting the account does not cancel a store subscription; send the user to the store first. */
export function CancelBeforeDelete() {
  const s = useBillingSession().data;
  const manage = manageUrl(s?.managementUrls, Platform.OS);
  if (!s || s.provider !== 'revenuecat' || s.plan === 'free' || !manage) return null;
  return (
    <Card>
      <Text variant="headline" color={colors.warning}>Hủy gói trước khi xóa tài khoản</Text>
      <Text variant="body">Xóa tài khoản không hủy gói đã mua ở App Store hoặc Google Play, và không hoàn tiền. Hãy hủy gói ở cửa hàng trước.</Text>
      <Button label="Mở trang quản lý gói" variant="plain" onPress={() => void Linking.openURL(manage)} />
    </Card>
  );
}
