import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import { FLOATING_TAB_BAR_SPACE } from '@/components/tabs';
import { messageFor } from '@/lib/errors';
import { colors, radius, space, type, type TypeVariant } from '@/theme';

const canGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

export function Text({ variant = 'body', color = colors.ink, style, ...props }: TextProps & { variant?: TypeVariant; color?: string }) {
  return <RNText {...props} style={[type[variant], { color }, style]} />;
}

export function Icon({ ios, android, size = 22, color = colors.ink }: { ios: string; android: string; size?: number; color?: string }) {
  return <SymbolView name={{ ios, android, web: android } as SymbolViewProps['name']} size={size} tintColor={color} />;
}

/** Liquid Glass on iOS 26+, a frosted white panel elsewhere. */
export function Glass({ style, children, interactive }: { style?: StyleProp<ViewStyle>; children?: ReactNode; interactive?: boolean }) {
  if (canGlass) return <GlassView isInteractive={interactive} style={[styles.glassBase, style]}>{children}</GlassView>;
  return <View style={[styles.glassBase, styles.glassFallback, style]}>{children}</View>;
}

/** Scrolling page with an iOS-style large title; leaves room for the floating tab bar. */
export function Screen({ title, subtitle, right, children, background = colors.ground }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; background?: string }) {
  const padding = useTabScreenPadding();
  return (
    <TabScreenFrame background={background}>
      <ScrollView style={{ flex: 1, backgroundColor: background }} contentInsetAdjustmentBehavior="never" contentContainerStyle={[padding, { gap: space.lg }]}>
        <ScreenHeader title={title} subtitle={subtitle} right={right} />
        {children}
      </ScrollView>
    </TabScreenFrame>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="largeTitle" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="callout" color={colors.inkSecondary}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Content padding for a tab screen's scroll container (ScrollView or FlatList). */
export function useTabScreenPadding(): ViewStyle {
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  return {
    // iOS: TabScreenFrame's native SafeAreaView already excludes status bar and tab bar.
    // Android: we add the top inset; the floating tab bar overlays the content.
    paddingTop: ios ? space.sm : insets.top + space.md,
    paddingBottom: ios ? space.xl : insets.bottom + FLOATING_TAB_BAR_SPACE,
    paddingHorizontal: space.xl,
    flexGrow: 1,
  };
}

/** Tabs set disableAutomaticContentInsets, so on iOS this measures the real tab bar height and
 * flexGrow content (empty/error states) centres in the visible area. */
export function TabScreenFrame({ background, children }: { background: string; children: ReactNode }) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return (
    <SafeAreaView edges={{ top: true, bottom: true }} collapsable={false} style={{ flex: 1, backgroundColor: background }}>
      {children}
    </SafeAreaView>
  );
}

type ButtonProps = { label: string; onPress?: () => void; variant?: 'primary' | 'ink' | 'glass' | 'plain' | 'danger'; disabled?: boolean; loading?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle> };

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style }: ButtonProps) {
  const fg = variant === 'primary' || variant === 'ink' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.ink;
  const content = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text variant="headline" color={fg}>{label}</Text>
    </>
  );
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => { void Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [{ opacity: inactive ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      {variant === 'glass' ? (
        <Glass interactive style={styles.button}>{content}</Glass>
      ) : (
        <View style={[styles.button, variant === 'primary' && { backgroundColor: colors.accent }, variant === 'ink' && { backgroundColor: colors.ink },variant === 'danger' && { backgroundColor: colors.dangerSoft }, variant === 'plain' && { backgroundColor: colors.fill }]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LoadingState({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: '100%', maxWidth: 240, gap: 8 }}>
        <View style={{ height: 64, borderRadius: radius.md, backgroundColor: colors.fill }} />
        <View style={{ height: 12, width: '80%', borderRadius: 6, backgroundColor: colors.fill }} />
        <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: colors.fill }} />
      </View>
      <ActivityIndicator color={colors.inkSecondary} />
      <Text variant="callout" color={colors.inkSecondary}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.state}>
      {icon}
      <Text variant="headline" style={styles.center}>{title}</Text>
      {message ? <Text variant="callout" color={colors.inkSecondary} style={styles.center}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<Icon ios="exclamationmark.triangle" android="warning" size={30} color={colors.warning} />}
      title="Có lỗi xảy ra"
      message={messageFor(error)}
      action={onRetry ? <Button label="Thử lại" variant="plain" onPress={onRetry} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  glassBase: { overflow: 'hidden' },
  glassFallback: { backgroundColor: colors.glassFallback, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.9)' },
  button: { minHeight: 50, paddingHorizontal: space.xl, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: 48, paddingHorizontal: space.xl },
  center: { textAlign: 'center' },
});
