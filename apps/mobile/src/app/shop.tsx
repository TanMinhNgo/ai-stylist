import type { GarmentType } from '@stylist/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { recordAffiliateClick, useAffiliateProducts } from '@/features/integrations/hooks';
import { useHeldKey } from '@/features/stylist/hooks';
import { RequestError } from '@/lib/errors';
import { colors, space } from '@/theme';

/** Partner products for an accessory the stylist suggested. Only catalog URLs from the API are opened. */
export default function ShopScreen() {
  const { q, type } = useLocalSearchParams<{ q?: string; type?: GarmentType }>();
  const products = useAffiliateProducts({ q: q || undefined, type: type || undefined });
  const clicks = useHeldKey();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(productId: string, url: string) {
    setOpening(productId);
    // Same product kept on retry → same click id, so an ambiguous retry is counted once.
    const id = clicks.take({ productId });
    try {
      await recordAffiliateClick(id, productId);
      clicks.settle();
    } catch (e) {
      clicks.settle(e);
      // The product left the catalog: its link is no longer vouched for.
      if (e instanceof RequestError && e.code === 'NOT_FOUND') {
        setOpening(null);
        return Alert.alert('Sản phẩm không còn', 'Sản phẩm này đã được gỡ khỏi danh sách. Hãy chọn sản phẩm khác.');
      }
    }
    setOpening(null);
    await WebBrowser.openBrowserAsync(url);
  }

  const data = products.data;
  return (
    <Screen title="Tìm mua" subtitle={q ? `Theo gợi ý: ${q}` : undefined}>
      {products.isPending ? (
        <LoadingState label="Đang tìm sản phẩm…" />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <>
          <Text variant="caption" color={colors.inkSecondary}>{data!.disclosure}</Text>
          {data!.items.length ? (
            data!.items.map((p) => (
              <Pressable key={p.id} onPress={() => open(p.id, p.url)} disabled={opening !== null} accessibilityRole="link" accessibilityLabel={`${p.name}, ${p.merchant}`}>
                <Card style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{p.name}</Text>
                    <Text variant="caption" color={colors.inkSecondary}>{p.merchant}</Text>
                  </View>
                  <Icon ios="arrow.up.right.square" android="open_in_new" size={18} color={colors.accent} />
                </Card>
              </Pressable>
            ))
          ) : (
            <EmptyState title={data!.status === 'not_configured' ? 'Chưa có cửa hàng đối tác' : 'Chưa có sản phẩm phù hợp'} message="Bạn vẫn có thể phối món tương tự từ tủ đồ của mình." />
          )}
        </>
      )}
      {opening ? <Text variant="caption" color={colors.inkSecondary}>Đang mở cửa hàng…</Text> : null}
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: space.md } });
