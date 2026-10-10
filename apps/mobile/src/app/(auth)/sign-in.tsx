import { useSSO } from '@clerk/expo/experimental';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button, Icon, Text } from '@/components/ui';
import { authMessage } from '@/features/auth/errors';
import { useEmailCodeAuth } from '@/features/auth/hooks';
import { colors, radius, space, type } from '@/theme';

// Closes the browser tab left open by the OAuth redirect on web.
WebBrowser.maybeCompleteAuthSession();

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const RESEND_SECONDS = 30;
const EMAIL = /^\S+@\S+\.\S+$/;

const FEATURES = [
  { ios: 'person.crop.rectangle', android: 'portrait', text: 'Thử đồ ngay trên ảnh của bạn' },
  { ios: 'sparkles', android: 'auto_awesome', text: 'Stylist AI gợi ý cách phối và phụ kiện' },
  { ios: 'hanger', android: 'checkroom', text: 'Tủ đồ tự gắn tag, tìm món trong vài giây' },
] as const;

type Strategy = 'oauth_google' | 'oauth_apple';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const auth = useEmailCodeAuth();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ssoBusy, setSsoBusy] = useState<Strategy | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // ponytail: Apple uses the browser OAuth flow so it works in Expo Go; switch to native
  // useSignInWithApple (@clerk/expo/apple) once there is a dev build with our own bundle ID.
  async function signInWith(strategy: Strategy) {
    setSsoBusy(strategy);
    setSsoError(null);
    try {
      await startSSOFlow({ strategy });
    } catch (e) {
      setSsoError(authMessage(e));
    } finally {
      setSsoBusy(null);
    }
  }

  useEffect(() => {
    if (auth.awaitingCode) setCooldown(RESEND_SECONDS);
  }, [auth.awaitingCode]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Verify as soon as the sixth digit lands, like the system OTP autofill expects.
  useEffect(() => {
    if (code.length === 6 && !auth.busy) auth.verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const error = auth.error ?? ssoError;
  const busy = auth.busy || ssoBusy !== null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.hero, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Icon ios="sparkles" android="auto_awesome" size={18} color="#FFFFFF" />
            </View>
            <Text variant="headline" style={{ letterSpacing: 0.6 }}>AI STYLIST</Text>
          </View>

          <Text accessibilityRole="header" style={styles.headline}>{'Nhà thiết kế\nriêng của bạn.'}</Text>
          <Text variant="body" color={colors.inkSecondary} style={{ maxWidth: 320 }}>
            Phối đồ từ chính tủ đồ của bạn, thử lên ảnh trước khi mặc.
          </Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.text} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon ios={f.ios} android={f.android} size={18} color={colors.accent} />
                </View>
                <Text variant="callout" style={{ flex: 1 }}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          {auth.awaitingCode ? (
            <Animated.View key="code" entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(160)} style={{ gap: space.lg }}>
              <Pressable
                onPress={() => { setCode(''); auth.reset(); }}
                accessibilityRole="button"
                accessibilityLabel="Quay lại, đổi email"
                hitSlop={12}
                style={styles.back}>
                <Icon ios="chevron.left" android="arrow_back" size={16} color={colors.accent} />
                <Text variant="callout" color={colors.accent} style={{ fontWeight: '600' }}>Đổi email</Text>
              </Pressable>
              <View style={{ gap: space.xs }}>
                <Text variant="title">Nhập mã xác minh</Text>
                <Text variant="callout" color={colors.inkSecondary}>
                  Chúng tôi đã gửi mã 6 số tới <Text variant="callout" style={{ fontWeight: '600' }}>{email.trim()}</Text>
                </Text>
              </View>
              <CodeInput value={code} onChange={setCode} disabled={auth.busy} />
              <Button label="Xác minh" onPress={() => auth.verify(code)} loading={auth.busy} disabled={code.length !== 6} />
              <Pressable
                onPress={() => { auth.resend(); setCooldown(RESEND_SECONDS); }}
                disabled={cooldown > 0 || auth.busy}
                accessibilityRole="button"
                style={styles.resend}>
                <Text variant="callout" color={cooldown > 0 ? colors.inkSecondary : colors.accent} style={{ fontWeight: '600' }}>
                  {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View key="start" entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(160)} style={{ gap: space.md }}>
              <Text variant="title">Bắt đầu</Text>
              {Platform.OS === 'ios' ? (
                <Button
                  label="Tiếp tục với Apple"
                  variant="ink"
                  onPress={() => signInWith('oauth_apple')}
                  loading={ssoBusy === 'oauth_apple'}
                  disabled={busy}
                  icon={<Icon ios="apple.logo" android="phone_iphone" size={18} color="#FFFFFF" />}
                />
              ) : null}
              <Pressable
                onPress={() => signInWith('oauth_google')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Tiếp tục với Google"
                style={({ pressed }) => [styles.google, { opacity: busy && ssoBusy !== 'oauth_google' ? 0.4 : pressed ? 0.7 : 1 }]}>
                <GoogleMark />
                <Text variant="headline">{ssoBusy === 'oauth_google' ? 'Đang mở Google…' : 'Tiếp tục với Google'}</Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text variant="footnote" color={colors.inkSecondary}>hoặc</Text>
                <View style={styles.line} />
              </View>

              <View style={styles.field}>
                <Icon ios="envelope" android="mail" size={18} color={colors.inkSecondary} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Email của bạn"
                  placeholderTextColor={colors.inkTertiary}
                  accessibilityLabel="Email"
                  returnKeyType="go"
                  editable={!busy}
                  onSubmitEditing={() => EMAIL.test(email.trim()) && auth.sendCode(email)}
                  style={styles.input}
                />
              </View>
              <Button label="Tiếp tục với email" onPress={() => auth.sendCode(email)} loading={auth.busy} disabled={!EMAIL.test(email.trim()) || ssoBusy !== null} />
            </Animated.View>
          )}

          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Icon ios="exclamationmark.circle.fill" android="error" size={16} color={colors.danger} />
              <Text variant="footnote" color={colors.danger} style={{ flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <Text variant="caption" color={colors.inkSecondary} style={styles.legal}>
            Bằng việc tiếp tục, bạn đồng ý với <Text variant="caption" style={styles.legalStrong}>Điều khoản sử dụng</Text> và{' '}
            <Text variant="caption" style={styles.legalStrong}>Chính sách quyền riêng tư</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Six visual boxes over one hidden input, so paste and SMS/email autofill still work. */
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessible={false}>
      <View style={styles.codeRow}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === Math.min(value.length, 5) && !disabled;
          return (
            <View key={i} style={[styles.codeBox, active && styles.codeBoxActive]}>
              <Text style={styles.codeDigit}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        editable={!disabled}
        caretHidden
        accessibilityLabel="Mã xác minh 6 số"
        style={styles.codeHidden}
      />
    </Pressable>
  );
}

// Official Google "G" mark, required on Google sign-in buttons by Google's branding guidelines.
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  hero: { flex: 1, paddingHorizontal: space.xxl, paddingBottom: space.xxl, gap: space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  mark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  headline: { fontFamily: SERIF, fontSize: 40, lineHeight: 46, color: colors.ink, letterSpacing: -0.5 },
  features: { gap: space.md, marginTop: space.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  featureIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    gap: space.lg,
    shadowColor: '#14141E',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  google: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.18)' },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 52, borderRadius: radius.sm + 2, backgroundColor: colors.fill, paddingHorizontal: 14 },
  input: { ...type.body, flex: 1, height: 52, color: colors.ink, fontSize: 17 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  codeBox: { flex: 1, aspectRatio: 0.82, maxHeight: 60, borderRadius: radius.sm, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  codeBoxActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  codeDigit: { fontSize: 26, lineHeight: 32, fontWeight: '600', color: colors.ink },
  codeHidden: { ...StyleSheet.absoluteFill, opacity: 0.011, color: 'transparent' },
  resend: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: space.md },
  legal: { textAlign: 'center', lineHeight: 17 },
  legalStrong: { color: colors.ink, fontWeight: '600' },
});
