import { useAuth, useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { useHealth } from '@/features/health/hooks';
import { useMe } from '@/features/me/hooks';
import { colors, radius, space } from '@/theme';

export default function ProfileScreen() {
  const health = useHealth();
  const me = useMe();
  const { user } = useUser();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Account data comes from our API (/me); Clerk only supplies display name and avatar.
  const email = me.data ? (me.data.email ?? 'Tài khoản chưa có email') : me.isPending ? 'Đang tải…' : '';
  const name = user?.fullName || me.data?.email?.split('@')[0] || 'Bạn';

  return (
    <Screen title="Hồ sơ">
      <View style={styles.identity}>
        <View style={styles.avatar}>
          {user?.hasImage ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} accessibilityIgnoresInvertColors />
          ) : (
            <Icon ios="person.fill" android="person" size={30} color={colors.inkSecondary} />
          )}
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text variant="title" numberOfLines={1}>{name}</Text>
          <Text variant="callout" color={colors.inkSecondary} numberOfLines={1}>{email}</Text>
        </View>
      </View>

      {me.isError ? (
        <Card>
          <ErrorState error={me.error} onRetry={() => me.refetch()} />
        </Card>
      ) : null}

      <Pressable onPress={() => router.push('/model-photos')} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}>
        <Icon ios="person.crop.rectangle" android="portrait" size={20} color={colors.accent} />
        <Text variant="body" style={{ flex: 1 }}>Ảnh người mẫu</Text>
        <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.inkTertiary} />
      </Pressable>

      <Pressable onPress={() => router.push('/style-profile')} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}>
        <Icon ios="sparkles" android="auto_awesome" size={20} color={colors.accent} />
        <Text variant="body" style={{ flex: 1 }}>Hồ sơ style</Text>
        <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.inkTertiary} />
      </Pressable>

      <Text variant="footnote" color={colors.inkSecondary} style={styles.sectionLabel}>KẾT NỐI MÁY CHỦ</Text>
      <Card>
        {health.isPending ? (
          <LoadingState label="Đang kiểm tra máy chủ…" />
        ) : health.isError ? (
          <ErrorState error={health.error} onRetry={() => health.refetch()} />
        ) : (
          <View style={styles.row} accessibilityLabel="Máy chủ đang hoạt động">
            <View style={styles.okDot}>
              <Icon ios="checkmark" android="check" size={14} color="#FFFFFF" />
            </View>
            <Text variant="headline" style={{ flex: 1 }}>Máy chủ đang hoạt động</Text>
          </View>
        )}
        <Text variant="caption" color={colors.inkSecondary}>{process.env.EXPO_PUBLIC_API_URL ?? 'Chưa cấu hình EXPO_PUBLIC_API_URL'}</Text>
      </Card>

      <Button
        label="Đăng xuất"
        variant="danger"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#DCD6CC', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 64, height: 64 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  sectionLabel: { marginLeft: space.lg, marginBottom: -space.sm, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  okDot: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
