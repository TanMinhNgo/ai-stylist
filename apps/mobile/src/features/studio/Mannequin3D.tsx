import type { BodyKey } from '@stylist/shared';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import meta from '@/assets/mannequin/mannequin.json';
import { Glass, Icon, Text } from '@/components/ui';
import { contactShadow, dress } from '@/features/studio/dress';
import { spriteRect, stagePlan, studioCamera, type Picks, type Preset } from '@/features/studio/outfit';
import { loadBody } from '@/features/studio/scene';
import { colors } from '@/theme';

type Stage = { renderer: THREE.WebGLRenderer; fig: THREE.Group; skin: THREE.MeshStandardMaterial; raf: number };
type Props = { body: BodyKey; picks: Picks; preset: Preset | null; skin: string; onSpriteError?: () => void; style?: StyleProp<ViewStyle> };

/**
 * Front view: bare mannequin + front PNGs laid over it (pieces without a PNG for this body stay 3D proxies).
 * Dragging switches to orbit: every piece becomes a simulated 3D proxy and the PNGs hide, since a flat image cannot turn.
 */
export function Mannequin3D({ body, picks, preset, skin, onSpriteError, style }: Props) {
  const stage = useRef<Stage | null>(null);
  const spin = useRef({ y: 0, target: 0, dragFrom: 0, lastTouch: 0, front: true, settled: false });
  const [view, setView] = useState<'front' | 'orbit'>('front');
  const [settled, setSettled] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Proxies stay on until the turn back to front has finished, so the body never flashes bare.
  const front = view === 'front' && settled;
  const plan = useMemo(() => stagePlan(picks, preset, body, front ? 'front' : 'orbit'), [picks, preset, body, front]);

  const pan = useRef(
    PanResponder.create({
      // Taps fall through to the buttons on the stage; only a horizontal drag turns the mannequin.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        spin.current.front = false;
        spin.current.settled = false;
        setSettled(false);
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
    s.settled = false;
    setView('front');
  }

  function onContextCreate(gl: ExpoWebGLRenderingContext) {
    try {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      // three expects a canvas; expo-gl only gives a context, so hand it the minimum it touches.
      const canvas = { width: w, height: h, style: {}, clientWidth: w, clientHeight: h, addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl };
      const renderer = new THREE.WebGLRenderer({ canvas: canvas as unknown as HTMLCanvasElement, context: gl, antialias: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const scene = new THREE.Scene();
      const camera = studioCamera(w / h);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bc, 1.1));
      const key = new THREE.DirectionalLight(0xfff6ec, 1.8);
      key.position.set(2.2, 4, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xdfe6ff, 0.7);
      rim.position.set(-3, 2.5, -2);
      scene.add(rim);
      scene.add(contactShadow());

      const fig = new THREE.Group();
      scene.add(fig);
      const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5 });
      stage.current = { renderer, fig, skin: skinMat, raf: 0 };

      const loop = () => {
        const s = spin.current;
        if (!s.front && Date.now() - s.lastTouch > 2500) s.target += 0.004;
        s.y += (s.target - s.y) * 0.12;
        if (s.front && !s.settled && Math.abs(s.y) < 0.003) {
          s.y = 0;
          s.settled = true;
          setSettled(true);
        }
        fig.rotation.y = s.y;
        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (stage.current) stage.current.raf = requestAnimationFrame(loop);
      };
      loop();
      setReady(true);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    loadBody(body)
      .then((m) => {
        if (!alive || !stage.current) return;
        dress(stage.current.fig, m, plan.looks, stage.current.skin);
        setLoaded(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [ready, body, plan.looks]);

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

  const showSprites = front && loaded && !!size;
  const camera = useMemo(() => size && studioCamera(size.width / size.height), [size]);
  const lm = meta[body].lm;

  return (
    <View style={style} onLayout={(e) => setSize(e.nativeEvent.layout)} {...pan.panHandlers}>
      {failed ? (
        <View style={styles.center}>
          <Text variant="callout" color={colors.inkSecondary}>Thiết bị không hiển thị được 3D</Text>
        </View>
      ) : (
        <>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} accessible accessibilityRole="image" accessibilityLabel={view === 'front' ? 'Người mẫu nhìn chính diện mặc đồ đang chọn' : 'Người mẫu 3D mô phỏng, kéo ngang để xoay'} />
          {showSprites
            ? plan.sprites.map((layer) => (
                <Image key={layer.key} source={layer.sprite.source} style={[styles.sprite, spriteRect(layer, lm, size!, camera!)]} contentFit="contain" pointerEvents="none" onError={onSpriteError} />
              ))
            : null}
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
            <Glass style={styles.badge}>
              <Text variant="caption" color="#3A3A40">{view === 'front' ? (plan.sprites.length ? 'Chính diện · hình PNG' : 'Chính diện') : '3D mô phỏng · không phải ảnh thật'}</Text>
            </Glass>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  sprite: { position: 'absolute' },
  badgeRow: { position: 'absolute', top: 6, right: 16, alignItems: 'flex-end', gap: 6 },
  badge: { height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
