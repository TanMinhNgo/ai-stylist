import type { BodyKey } from '@stylist/shared';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import { Glass, Icon, Text } from '@/components/ui';
import { contactShadow, dress, toon } from '@/features/studio/dress';
import { looksOf, studioCamera, type Picks } from '@/features/studio/outfit';
import { loadBody } from '@/features/studio/scene';
import { colors } from '@/theme';

type Stage = { renderer: THREE.WebGLRenderer; fig: THREE.Group; skin: THREE.MeshToonMaterial; raf: number };
type Props = { body: BodyKey; picks: Picks; skin: string; style?: StyleProp<ViewStyle> };

/** Anime-style (cel-shaded, ink-outlined) mannequin wearing 3D pieces built from each garment's tags. Drag to turn. */
export function Mannequin3D({ body, picks, skin, style }: Props) {
  const stage = useRef<Stage | null>(null);
  const spin = useRef({ y: 0, target: 0, dragFrom: 0, lastTouch: 0, front: true });
  const [view, setView] = useState<'front' | 'orbit'>('front');
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const fail = (e: unknown) => {
    console.warn('[Mannequin3D]', e);
    setFailed(true);
  };
  const retry = () => {
    if (stage.current) {
      cancelAnimationFrame(stage.current.raf);
      stage.current.renderer.dispose();
      stage.current = null;
    }
    setReady(false);
    setLoaded(false);
    setFailed(false);
    setAttempt((a) => a + 1);
  };

  const looks = useMemo(() => looksOf(picks), [picks]);

  const pan = useRef(
    PanResponder.create({
      // Taps fall through to the buttons on the stage; only a horizontal drag turns the mannequin.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        spin.current.front = false;
        setView('orbit');
        spin.current.dragFrom = spin.current.target;
        spin.current.lastTouch = Infinity;
      },
      onPanResponderMove: (_, g) => {
        spin.current.target = spin.current.dragFrom + g.dx * 0.012;
      },
      onPanResponderRelease: () => {
        spin.current.lastTouch = Date.now();
      },
      onPanResponderTerminate: () => {
        spin.current.lastTouch = Date.now();
      },
    }),
  ).current;

  function faceFront() {
    const s = spin.current;
    // Take the short way round to angle 0.
    s.y = Math.atan2(Math.sin(s.y), Math.cos(s.y));
    s.target = 0;
    s.front = true;
    setView('front');
  }

  function onContextCreate(gl: ExpoWebGLRenderingContext) {
    try {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      // three expects a canvas; expo-gl only gives a context, so hand it the minimum it touches.
      const canvas = { width: w, height: h, style: {}, clientWidth: w, clientHeight: h, addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl };
      // No `context:` — expo-gl's WebGL2 context is `instanceof WebGLRenderingContext`, which three (r163+) rejects as WebGL 1.
      // three then asks canvas.getContext('webgl2'), which hands back the same gl.
      const renderer = new THREE.WebGLRenderer({ canvas: canvas as unknown as HTMLCanvasElement, antialias: true, alpha: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      // Cel colours stay flat: no filmic tone mapping.
      renderer.toneMapping = THREE.NoToneMapping;

      const scene = new THREE.Scene();
      const camera = studioCamera(w / h);
      // Toon bands come from one key light; the soft fill keeps the shadow band from going muddy.
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2c0, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(2, 3.5, 4);
      scene.add(key);
      scene.add(contactShadow());

      const fig = new THREE.Group();
      scene.add(fig);
      const skinMat = toon(skin);
      stage.current = { renderer, fig, skin: skinMat, raf: 0 };

      const loop = () => {
        const s = spin.current;
        if (!s.front && Date.now() - s.lastTouch > 2500) s.target += 0.004;
        s.y += (s.target - s.y) * 0.12;
        fig.rotation.y = s.y;
        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (stage.current) stage.current.raf = requestAnimationFrame(loop);
      };
      loop();
      setReady(true);
    } catch (e) {
      fail(e);
    }
  }

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    loadBody(body)
      .then((m) => {
        if (!alive || !stage.current) return;
        dress(stage.current.fig, m, looks, stage.current.skin);
        setLoaded(true);
      })
      .catch((e) => alive && fail(e));
    return () => {
      alive = false;
    };
  }, [ready, body, looks]);

  useEffect(() => {
    stage.current?.skin.color.set(skin);
  }, [skin, ready]);

  useEffect(
    () => () => {
      if (stage.current) {
        cancelAnimationFrame(stage.current.raf);
        stage.current.renderer.dispose();
        stage.current = null;
      }
    },
    [],
  );

  return (
    <View style={style} {...pan.panHandlers}>
      {failed ? (
        <View style={styles.center}>
          <Text variant="callout" color={colors.inkSecondary}>Chưa hiển thị được người mẫu 3D</Text>
          <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
            <Text variant="callout" color={colors.accent} style={{ fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <GLView key={attempt} style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} accessible accessibilityRole="image" accessibilityLabel="Người mẫu anime 3D mặc đồ đang chọn, kéo ngang để xoay" />
          {!loaded ? (
            <View style={styles.center} pointerEvents="none">
              <ActivityIndicator color={colors.inkSecondary} />
            </View>
          ) : null}
          <View style={styles.badgeRow} pointerEvents="box-none">
            {view === 'orbit' ? (
              <Pressable onPress={faceFront} accessibilityRole="button" accessibilityLabel="Xem chính diện" hitSlop={6}>
                <Glass interactive style={styles.badge}>
                  <Icon ios="person.fill.viewfinder" android="center_focus_strong" size={14} color={colors.accent} />
                  <Text variant="footnote" color={colors.accent} style={{ fontWeight: '600' }}>Xem chính diện</Text>
                </Glass>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
  badgeRow: { position: 'absolute', top: 6, right: 16, alignItems: 'flex-end', gap: 6 },
  badge: { height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
