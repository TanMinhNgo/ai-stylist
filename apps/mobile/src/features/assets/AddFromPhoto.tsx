import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { CropBox } from '@/features/assets/CropBox';
import { clampCrop, cropValid, typesFor, type CropRect, type GenType, type MenuId } from '@/features/assets/logic';
import { TypePicker } from '@/features/assets/pickers';
import { useUploadGarment } from '@/features/garments/hooks';
import { uploadFlowMessage } from '@/features/media/upload-flow';
import { cropImage, pickImages, type LocalImage } from '@/lib/image';
import { colors, radius, space } from '@/theme';

/** One garment per photo: pick its type, crop it out (people in the photo stay outside the frame), preview, upload. */
export function AddFromPhoto() {
  const [menu, setMenu] = useState<MenuId>('top');
  const [type, setType] = useState<GenType | null>(null);
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [preview, setPreview] = useState<LocalImage | null>(null);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const upload = useUploadGarment();

  async function choose(camera: boolean) {
    const picked = await pickImages({ camera });
    if ('denied' in picked) {
      Alert.alert('Chưa có quyền dùng camera', 'Bật quyền camera trong Cài đặt để chụp món đồ.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const image = picked.images[0];
    if (!image) return;
    setPhoto(image);
    setPreview(null);
    upload.reset();
    // Start slightly inside the edges so both handles are easy to grab.
    setCrop(clampCrop({ x: image.width * 0.05, y: image.height * 0.05, width: image.width * 0.9, height: image.height * 0.9 }, image));
  }

  async function showPreview() {
    if (!photo || !crop || !cropValid(crop, photo)) return;
    setPreview(await cropImage(photo, crop));
  }

  function send() {
    if (!preview || !type) return;
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    upload.mutate(
      { image: preview, extra: { requestedType: type }, signal: controller.signal, onProgress: setProgress },
      { onSuccess: (g) => router.replace({ pathname: '/garment/[id]', params: { id: g.id } }) },
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <Section title="1. Đây là món gì?">
        <TypePicker
          menu={menu}
          type={type}
          onMenu={(m) => {
            setMenu(m);
            setType(typesFor(m)[0] ?? null);
          }}
          onType={setType}
        />
      </Section>

      <Section title="2. Chọn ảnh và cắt gọn một món">
        <Text variant="footnote" color={colors.inkSecondary}>Nếu ảnh có người mặc, kéo khung chỉ ôm món đồ cần thêm. Mỗi lần chỉ một món.</Text>
        {photo && crop ? (
          preview ? (
            <View style={{ gap: space.sm }}>
              <View style={styles.preview}>
                <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Ảnh món đồ sau khi cắt" />
              </View>
              <Button label="Chỉnh lại khung cắt" variant="plain" onPress={() => setPreview(null)} disabled={upload.isPending} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <CropBox image={photo} value={crop} onChange={setCrop} />
              <Button label="Xem trước ảnh đã cắt" variant="ink" onPress={showPreview} disabled={!cropValid(crop, photo)} />
            </View>
          )
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Chụp ảnh" variant="plain" onPress={() => choose(true)} style={{ flex: 1 }} disabled={upload.isPending} icon={<Icon ios="camera" android="photo_camera" size={18} />} />
          <Button label={photo ? 'Ảnh khác' : 'Thư viện'} variant="plain" onPress={() => choose(false)} style={{ flex: 1 }} disabled={upload.isPending} icon={<Icon ios="photo" android="image" size={18} />} />
        </View>
      </Section>

      {upload.isPending ? (
        <View style={{ gap: space.sm }}>
          <Text variant="callout" style={{ fontWeight: '600' }}>Đang tải lên {Math.round(progress * 100)}%</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Button label="Hủy" variant="plain" onPress={() => abort.current?.abort()} />
        </View>
      ) : (
        <Button label="Lưu vào tủ đồ" onPress={send} disabled={!preview || !type} icon={<Icon ios="arrow.up.circle" android="upload" size={18} color="#FFFFFF" />} />
      )}
      {upload.isError && !abort.current?.signal.aborted ? <Text variant="footnote" color={colors.danger}>{uploadFlowMessage(upload.error)}</Text> : null}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  preview: { height: 280, borderRadius: radius.md, backgroundColor: '#ECE9E4', overflow: 'hidden' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
