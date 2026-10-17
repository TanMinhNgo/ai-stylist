import { ShareTokenParams } from '@stylist/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { usePublicLookbook } from '@/features/integrations/hooks';
import { RequestError } from '@/lib/errors';
import { colors, space } from '@/theme';

/** Someone's shared lookbook, opened from a link; works signed in or out. Images are signed for at most 60 s. */
export default function SharedLookbookScreen() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const valid = ShareTokenParams.safeParse({ token }).success;
  return valid ? <Viewer token={token} /> : <Gone />;
}

function Viewer({ token }: { token: string }) {
  const lookbook = usePublicLookbook(token);
  const { width } = useWindowDimensions();
  const size = (width - space.xl * 2 - space.md) / 2;
  if (lookbook.isPending) return <Screen title="Lookbook được chia sẻ"><LoadingState /></Screen>;
  if (lookbook.isError) return lookbook.error instanceof RequestError && lookbook.error.code === 'NOT_FOUND' ? <Gone /> : <Screen title="Lookbook được chia sẻ"><ErrorState error={lookbook.error} onRetry={() => lookbook.refetch()} /><Back /></Screen>;
  const l = lookbook.data;
  return (
    <Screen title={l.title} subtitle={`Link hết hạn ${new Date(l.expiresAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}`}>
      {l.outfits.length ? (
        <View style={styles.grid}>
          {l.outfits.map((o, i) => (
            // Signed URLs expire within a minute; a failed load asks for fresh ones.
            <Image key={i} source={{ uri: o.imageUrl }} style={{ width: size, height: (size * 4) / 3, borderRadius: 12, backgroundColor: '#E9E4DD' }} contentFit="cover" onError={() => void lookbook.refetch()} accessibilityLabel={`Outfit ${i + 1}`} />
          ))}
        </View>
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Các outfit trong link này không còn được chia sẻ.</Text>
      )}
      <Back />
    </Screen>
  );
}

function Gone() {
  return (
    <Screen title="Lookbook được chia sẻ">
      <EmptyState title="Link không còn hoạt động" message="Link đã hết hạn, bị thu hồi hoặc không đúng." />
      <Back />
    </Screen>
  );
}

const Back = () => <Button label="Đóng" variant="plain" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md } });
