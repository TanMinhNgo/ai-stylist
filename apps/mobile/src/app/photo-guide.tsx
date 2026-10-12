import { ModelPhoto } from '@stylist/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button, Glass, Icon, Text } from '@/components/ui';
import { BODY_SHAPE_LABEL, SKIN_TONE_LABEL } from '@/features/garments/labels';
import { MAX_POLLS } from '@/features/media/pages';
import { uploadFlowMessage, uploadMedia } from '@/features/media/upload-flow';
import { useDefaultModelPhoto, useModelPhoto } from '@/features/model-photos/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { pickImages, type LocalImage } from '@/lib/image';
import { colors, radius, space } from '@/theme';

const EXAMPLES = [
  { ok: true, label: 'Toàn thân, đứng thẳng', bg: '#E6EFEA', fg: '#5E6E66', people: 1, crop: false },
  { ok: true, label: 'Đủ sáng, nền gọn', bg: '#EEF0F3', fg: '#66707C', people: 1, crop: false },
  { ok: false, label: 'Bị cắt mất chân', bg: '#F3E9E4', fg: '#8A6D60', people: 1, crop: true },
  { ok: false, label: 'Có nhiều người', bg: '#F3E9E4', fg: '#8A6D60', people: 2, crop: false },
];

const TIPS = ['Đứng thẳng, tay buông tự nhiên, nhìn vào máy', 'Mặc đồ ôm vừa, tránh áo khoác dày', 'Đặt máy ngang hông, cách khoảng 2–3 mét'];

type State =
  | { kind: 'idle' }
  | { kind: 'denied' }
  | { kind: 'ready'; image: LocalImage }
  | { kind: 'uploading'; image: LocalImage; progress: number }
  | { kind: 'analyzing'; image: LocalImage; id: string }
  | { kind: 'error'; image?: LocalImage; message: string };

export default function PhotoGuideScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const photo = useModelPhoto(state.kind === 'analyzing' ? state.id : undefined);
  const defaultId = useDefaultModelPhoto((s) => s.id);
  const setDefault = useDefaultModelPhoto((s) => s.set);
  const client = useQueryClient();

  const result = state.kind === 'analyzing' ? photo.data : undefined;
  // The first usable photo becomes the try-on default.
  useEffect(() => {
    if (result?.status === 'ready' && !defaultId) setDefault(result.id);
    if (result && result.status !== 'pending') void client.invalidateQueries({ queryKey: ['model-photos'] });
  }, [result, defaultId, setDefault, client]);

  async function choose(camera: boolean) {
    const picked = await pickImages({ camera });
    if ('denied' in picked) return setState({ kind: 'denied' });
    if (picked.images[0]) setState({ kind: 'ready', image: picked.images[0] });
  }

  async function upload(image: LocalImage) {
    const controller = new AbortController();
    abort.current = controller;
    setState({ kind: 'uploading', image, progress: 0 });
    try {
      const created = await uploadMedia('model-photos', ModelPhoto, image, {
        signal: controller.signal,
        onProgress: (progress) => setState((s) => (s.kind === 'uploading' ? { ...s, progress } : s)),
      });
      setState({ kind: 'analyzing', image, id: created.id });
    } catch (e) {
      setState(controller.signal.aborted ? { kind: 'ready', image } : { kind: 'error', image, message: uploadFlowMessage(e) });
    }
  }

  const previewUri = 'image' in state && state.image ? state.image.uri : null;
  const failedCode = result?.status === 'failed' ? (result.errorCode ?? 'MEDIA_PROCESSING_FAILED') : null;
  // Polling stops after MAX_POLLS fetches; say so instead of spinning forever.
  const polls = state.kind === 'analyzing' ? (client.getQueryState(['model-photos', state.id])?.dataUpdateCount ?? 0) : 0;
  const timedOut = result?.status === 'pending' && polls >= MAX_POLLS;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: 200 + insets.bottom, paddingHorizontal: space.xl, gap: space.lg }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8}>
          <Glass interactive style={styles.back}>
            <Icon ios="chevron.left" android="arrow_back" size={20} />
          </Glass>
        </Pressable>
        <View style={{ gap: space.xs }}>
          <Text variant="largeTitle" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>Chụp ảnh người mẫu</Text>
          <Text variant="callout" color="#4A4A52">Ảnh càng chuẩn, kết quả thử đồ càng giống thật.</Text>
        </View>

        {previewUri ? (
          <View style={styles.preview}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="cover" accessibilityLabel="Ảnh người mẫu vừa chọn" />
          </View>
        ) : (
          <View style={styles.grid}>
            {EXAMPLES.map((e) => (
              <View key={e.label} style={styles.example}>
                <View style={[styles.exampleArt, { backgroundColor: e.bg }]}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: e.crop ? -44 : 12 }}>
                    {Array.from({ length: e.people }, (_, i) => (
                      <Silhouette key={i} color={e.fg} size={e.crop ? 150 : e.people > 1 ? 80 : 110} />
                    ))}
                  </View>
                  <View style={[styles.badge, { backgroundColor: e.ok ? colors.success : colors.danger }]}>
                    <Icon ios={e.ok ? 'checkmark' : 'xmark'} android={e.ok ? 'check' : 'close'} size={12} color="#FFFFFF" />
                  </View>
                </View>
                <Text variant="footnote" style={{ fontWeight: '500', padding: space.md }}>{e.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tips}>
          {TIPS.map((tip, i) => (
            <View key={tip} style={{ flexDirection: 'row', gap: space.md }}>
              <Text variant="callout" color={colors.accent} style={{ fontWeight: '600' }}>{i + 1}</Text>
              <Text variant="callout" style={{ flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Icon ios="lock" android="lock" size={16} color={colors.inkSecondary} />
          <Text variant="footnote" color="#4A4A52" style={{ flex: 1 }}>Ảnh được lưu riêng tư, chỉ dùng để thử đồ cho bạn. Bạn có thể xóa hẳn bất cứ lúc nào.</Text>
        </View>
      </ScrollView>

      <Glass style={[styles.actions, { bottom: insets.bottom + space.md }]}>
        <View accessibilityLiveRegion="polite" style={{ gap: space.sm + 2 }}>
          {state.kind === 'ready' ? (
            <>
              <Button label="Dùng ảnh này" onPress={() => upload(state.image)} icon={<Icon ios="arrow.up.circle" android="upload" size={18} color="#FFFFFF" />} />
              <Button label="Chọn ảnh khác" variant="plain" onPress={() => setState({ kind: 'idle' })} />
            </>
          ) : state.kind === 'uploading' ? (
            <>
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.accent} />
                <Text variant="headline" style={{ flex: 1 }}>Đang tải ảnh lên… {Math.round(state.progress * 100)}%</Text>
                <Button label="Hủy" variant="plain" onPress={() => abort.current?.abort()} />
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} />
              </View>
            </>
          ) : state.kind === 'analyzing' && result?.status === 'ready' ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.success }]}>
                  <Icon ios="checkmark" android="check" size={15} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline">Ảnh dùng được</Text>
                  {result.analysis ? (
                    <Text variant="footnote" color="#4A4A52">
                      Dáng người: {BODY_SHAPE_LABEL[result.analysis.bodyShape]} · Tông da: {SKIN_TONE_LABEL[result.analysis.skinTone]}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Button label="Xong" onPress={() => router.back()} />
            </>
          ) : state.kind === 'analyzing' && (failedCode || timedOut) ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.warning }]}>
                  <Text variant="headline" color="#FFFFFF">!</Text>
                </View>
                <Text variant="callout" style={{ flex: 1 }}>
                  {timedOut ? 'Phân tích lâu hơn bình thường. Ảnh vẫn được xử lý, bạn có thể xem lại sau trong Hồ sơ.' : messageFor(new RequestError(failedCode ?? 'MEDIA_PROCESSING_FAILED'))}
                </Text>
              </View>
              <Button label={timedOut ? 'Xong' : 'Chụp lại'} onPress={() => (timedOut ? router.back() : setState({ kind: 'idle' }))} />
            </>
          ) : state.kind === 'analyzing' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.accent} />
              <Text variant="headline" style={{ flex: 1 }}>Đang phân tích dáng người…</Text>
            </View>
          ) : (
            <>
              {state.kind === 'denied' ? (
                <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
                  <Text variant="footnote" color={colors.danger} style={styles.center}>Chưa có quyền dùng camera. Chạm để mở Cài đặt.</Text>
                </Pressable>
              ) : null}
              {state.kind === 'error' ? <Text variant="footnote" color={colors.danger} style={styles.center}>{state.message}</Text> : null}
              {state.kind === 'error' && state.image ? <Button label="Thử lại" onPress={() => upload(state.image!)} /> : null}
              <Button label="Chụp ảnh" variant={state.kind === 'error' && state.image ? 'plain' : 'primary'} onPress={() => choose(true)} icon={<Icon ios="camera" android="photo_camera" size={18} color={state.kind === 'error' && state.image ? colors.ink : '#FFFFFF'} />} />
              <Button label="Chọn từ thư viện" variant="plain" onPress={() => choose(false)} />
            </>
          )}
        </View>
      </Glass>
    </View>
  );
}

function Silhouette({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size * 0.8} height={size} viewBox="0 0 48 60" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx="24" cy="9" r="6" fill={color} />
      <Path d="M24 16c-6 0-9 3-9 9v13h4v20h4V40h2v18h4V38h4V25c0-6-3-9-9-9z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  example: { width: '47.5%', flexGrow: 1, borderRadius: radius.lg - 2, backgroundColor: colors.surface, overflow: 'hidden' },
  exampleArt: { height: 150, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  badge: { position: 'absolute', left: 10, top: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  preview: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, aspectRatio: 3 / 4 },
  previewImage: { width: '100%', height: '100%' },
  tips: { borderRadius: radius.md + 2, backgroundColor: colors.surface, padding: space.lg, gap: space.md },
  actions: { position: 'absolute', left: space.md, right: space.md, borderRadius: radius.xl, padding: space.md + 2, gap: space.sm + 2 },
  center: { textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  statusDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
