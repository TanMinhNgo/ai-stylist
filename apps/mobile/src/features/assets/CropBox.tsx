import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { clampCrop, type CropRect } from '@/features/assets/logic';
import type { LocalImage } from '@/lib/image';
import { colors } from '@/theme';

const MAX_HEIGHT = 420;
const HANDLE = 28;

/** Drag the frame to move it, drag a corner to resize. `value` is in image pixels and always stays inside the image. */
export function CropBox({ image, value, onChange }: { image: LocalImage; value: CropRect; onChange: (r: CropRect) => void }) {
  const [width, setWidth] = useState(0);
  const scale = width ? Math.min(width / image.width, MAX_HEIGHT / image.height) : 0;
  // PanResponders are created once; they read the latest props through this ref.
  const live = useRef({ value, onChange, scale, image, start: value });
  live.current = { ...live.current, value, onChange, scale, image };

  const pans = useRef(
    Object.fromEntries(
      (['move', 'tl', 'br'] as const).map((mode) => [
        mode,
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            live.current.start = live.current.value;
          },
          onPanResponderMove: (_, g) => {
            const { start: r, scale: s, image: img, onChange: change } = live.current;
            if (!s) return;
            const dx = g.dx / s, dy = g.dy / s;
            const next =
              mode === 'move' ? { ...r, x: r.x + dx, y: r.y + dy }
              : mode === 'tl' ? { x: r.x + dx, y: r.y + dy, width: r.width - dx, height: r.height - dy }
              : { ...r, width: r.width + dx, height: r.height + dy };
            change(clampCrop(next, img));
          },
        }),
      ]),
    ),
  ).current;

  const frame = { left: value.x * scale, top: value.y * scale, width: value.width * scale, height: value.height * scale };
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
      {scale ? (
        <View style={{ width: image.width * scale, height: image.height * scale }}>
          <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
          {/* Dim everything outside the frame. */}
          <View style={[styles.dim, { left: 0, right: 0, top: 0, height: frame.top }]} />
          <View style={[styles.dim, { left: 0, right: 0, top: frame.top + frame.height, bottom: 0 }]} />
          <View style={[styles.dim, { left: 0, width: frame.left, top: frame.top, height: frame.height }]} />
          <View style={[styles.dim, { left: frame.left + frame.width, right: 0, top: frame.top, height: frame.height }]} />
          <View {...pans.move.panHandlers} style={[styles.frame, frame]} accessible accessibilityLabel="Khung cắt, kéo để di chuyển" />
          <View {...pans.tl.panHandlers} style={[styles.handle, { left: frame.left - HANDLE / 2, top: frame.top - HANDLE / 2 }]} accessible accessibilityLabel="Góc trên trái, kéo để đổi cỡ" />
          <View {...pans.br.panHandlers} style={[styles.handle, { left: frame.left + frame.width - HANDLE / 2, top: frame.top + frame.height - HANDLE / 2 }]} accessible accessibilityLabel="Góc dưới phải, kéo để đổi cỡ" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)' },
  frame: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: colors.accent },
});
