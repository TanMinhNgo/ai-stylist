import type { GarmentSlot } from '@stylist/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR_SPACE } from '@/components/tabs';
import { Button, Glass, Icon, TabScreenFrame, Text } from '@/components/ui';
import { useGarments } from '@/features/garments/hooks';
import { useDefaultModelPhoto, useModelPhotos } from '@/features/model-photos/hooks';
import { CASUAL_OUTFITS, DEMO_ITEMS, DEMO_OUTFITS, type DemoOutfit } from '@/features/studio/catalog';
import { Mannequin3D } from '@/features/studio/Mannequin3D';
import { garmentWearable, pickKey, stagePlan, type Wearable } from '@/features/studio/outfit';
import { useStudio } from '@/features/studio/store';
import { newIdempotencyKey, useCreateTryOn, useTryOnJob } from '@/features/try-on/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

const TRY_ON_MAX = 4;
const TABS: { label: string; slots: GarmentSlot[] }[] = [
  { label: 'Áo', slots: ['top'] },
  { label: 'Áo khoác', slots: ['outer'] },
  { label: 'Quần & váy', slots: ['bottom'] },
  { label: 'Đầm & liền thân', slots: ['dress'] },
  { label: 'Giày', slots: ['shoes'] },
  { label: 'Túi', slots: ['bag'] },
  { label: 'Phụ kiện', slots: ['hat', 'eyewear', 'neck', 'belt', 'jewelry', 'watch'] },
];
const OCCASIONS = ['Đi làm', 'Đi chơi', 'Tiệc', 'Hẹn hò'];
const SKIN = { light: '#EBCFB8', medium: '#C9976F', dark: '#8A5A3E', unknown: '#ECE8E2' } as const;

const DEMO_TABS = [{ label: 'Bộ phối sẵn', slots: [] as GarmentSlot[] }, ...TABS];

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { body, picks, preset, occasion, setBody, toggle, wearOutfit, setOccasion } = useStudio();
  const [demo, setDemo] = useState(false);
  const [tab, setTab] = useState(0);
  const [outfitSection, setOutfitSection] = useState<'formal' | 'casual'>('formal');
  const [custom, setCustom] = useState(!OCCASIONS.includes(occasion));
  const tabs = demo ? DEMO_TABS : TABS;
  const current = tabs[Math.min(tab, tabs.length - 1)];

  const garments = useGarments(undefined);
  const mine = useMemo(() => (garments.data?.pages.flatMap((p) => p.items) ?? []).map(garmentWearable).filter((w): w is Wearable => !!w), [garments.data]);
  const tray = (demo ? DEMO_ITEMS : mine).filter((w) => current.slots.includes(w.tags.slot as GarmentSlot));
  // Keep paging until the current tab has something to show (the API pages across all categories).
  useEffect(() => {
    if (!demo && tray.length < 8 && garments.hasNextPage && !garments.isFetchingNextPage) void garments.fetchNextPage();
  }, [demo, tray.length, garments]);

  const photos = useModelPhotos();
  const defaultId = useDefaultModelPhoto((s) => s.id);
  const modelPhoto = photos.data?.items.find((p) => p.id === defaultId && p.status === 'ready');
  const skin = SKIN[modelPhoto?.analysis?.skinTone ?? 'unknown'];

  const worn = Object.values(picks);
  const outfitSelected = (o: DemoOutfit) => worn.length === o.members.length && o.members.every((w) => picks[pickKey(w.tags)]?.id === w.id);
  // Demo pieces have no API id: they only dress the mannequin and are never sent to /try-on.
  const forTryOn = worn.filter((w) => w.garmentId && w.tryOnAllowed);
  const tooMany = forTryOn.length > TRY_ON_MAX;
  // Real garments whose PNG was made for the other body: shown as 3D proxies, offer a variant.
  const mismatched = useMemo(() => stagePlan(picks, preset, body, 'front').mismatched.filter((w) => w.garmentId), [picks, preset, body]);

  const bottomSpace = Platform.OS === 'ios' ? space.sm : insets.bottom + FLOATING_TAB_BAR_SPACE;

  const create = useCreateTryOn();
  const activeJob = useStudio((s) => s.activeJob);
  const setActiveJob = useStudio((s) => s.setActiveJob);
  function tryOn() {
    if (!modelPhoto) return router.push('/photo-guide');
    const input = { modelPhotoId: modelPhoto.id, garmentIds: forTryOn.map((w) => w.garmentId!), occasion: occasion.trim() };
    // One key per tap: retries of this tap reuse it, a later tap is a new try-on.
    create.mutate(
      { input, key: newIdempotencyKey() },
      {
        onSuccess: ({ jobId }) => {
          setActiveJob({ id: jobId, ...input });
          router.push({ pathname: '/try-on/[jobId]', params: { jobId } });
        },
      },
    );
  }

  return (
    <TabScreenFrame background={colors.studio}>
      <View style={[styles.root, Platform.OS !== 'ios' && { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="largeTitle" accessibilityRole="header">Studio</Text>
            <Text variant="callout" color={colors.inkSecondary}>Phối đồ trên người mẫu 3D</Text>
          </View>
          <Pressable onPress={() => router.push(modelPhoto ? '/model-photos' : '/photo-guide')} accessibilityRole="button" accessibilityLabel={modelPhoto ? 'Ảnh người mẫu đang dùng' : 'Thêm ảnh người mẫu'} hitSlop={6}>
            <Glass interactive style={styles.avatar}>
              {modelPhoto ? <Image source={{ uri: modelPhoto.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon ios="person.crop.rectangle" android="portrait" size={20} color={colors.accent} />}
            </Glass>
          </Pressable>
        </View>

        <View style={styles.stage}>
          <Mannequin3D
            body={body}
            picks={picks}
            preset={preset}
            skin={skin}
            // Signed PNG URLs last 15 minutes; refetch the wardrobe for fresh ones.
            onSpriteError={() => void client.invalidateQueries({ queryKey: ['garments'] })}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stageBar} pointerEvents="box-none">
            <Glass style={styles.segment}>
              {(['f', 'm'] as const).map((b) => (
                <Pressable key={b} onPress={() => setBody(b)} accessibilityRole="radio" accessibilityState={{ checked: body === b }} style={[styles.segmentItem, body === b && styles.segmentOn]}>
                  <Text variant="footnote" style={{ fontWeight: '600' }}>{b === 'f' ? 'Nữ' : 'Nam'}</Text>
                </Pressable>
              ))}
            </Glass>
            <Glass style={styles.hint}>
              <Icon ios="arrow.left.and.right" android="swap_horiz" size={14} color="#3A3A40" />
              <Text variant="footnote" color="#3A3A40">Kéo để xoay</Text>
            </Glass>
          </View>
        </View>

        <Glass style={[styles.sheet, { marginBottom: bottomSpace }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="headline">Đang mặc {worn.length} món</Text>
              <Text variant="caption" color={tooMany ? colors.warning : colors.inkSecondary}>
                {tooMany ? `Thử lên ảnh tối đa ${TRY_ON_MAX} món, hãy bỏ bớt` : `Thử lên ảnh tối đa ${TRY_ON_MAX} món`}
                {worn.length > forTryOn.length ? ` · ${worn.length - forTryOn.length} món chỉ xem trên ma nơ canh` : ''}
              </Text>
            </View>
            <View style={styles.source}>
              {[false, true].map((d) => (
                <Pressable
                  key={String(d)}
                  onPress={() => {
                    setDemo(d);
                    setTab(0);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: demo === d }}
                  style={[styles.sourceItem, demo === d && styles.segmentOn]}>
                  <Text variant="caption" style={{ fontWeight: '600' }}>{d ? 'Bộ mẫu' : 'Của tôi'}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {mismatched.length ? (
            <Pressable onPress={() => router.push({ pathname: '/garment/[id]', params: { id: mismatched[0].garmentId! } })} accessibilityRole="button" style={styles.notice}>
              <Icon ios="info.circle" android="info" size={16} color={colors.warning} />
              <Text variant="caption" style={{ flex: 1 }}>
                {mismatched.length} món chưa có hình cho dáng {body === 'f' ? 'nữ' : 'nam'}, đang hiện mô phỏng 3D.
              </Text>
              <Text variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>Tạo biến thể</Text>
            </Pressable>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {tabs.map((t, i) => {
              const on = t === current;
              const has = t.slots.length ? worn.some((w) => t.slots.includes(w.tags.slot as GarmentSlot)) : [...DEMO_OUTFITS, ...CASUAL_OUTFITS].some(outfitSelected);
              return (
                <Pressable key={t.label} onPress={() => setTab(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]}>
                  <Text variant="footnote" color={on ? '#FFFFFF' : colors.ink} style={{ fontWeight: '600' }}>{t.label}</Text>
                  {has ? <View style={[styles.tabDot, { backgroundColor: on ? '#FFFFFF' : colors.accent }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {current.slots.length ? (
            <FlatList
              horizontal
              data={tray}
              keyExtractor={(w) => w.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
              onEndReached={() => !demo && garments.hasNextPage && !garments.isFetchingNextPage && garments.fetchNextPage()}
              renderItem={({ item }) => <TrayItem item={item} on={picks[pickKey(item.tags)]?.id === item.id} onPress={() => toggle(item)} />}
              ListFooterComponent={
                demo ? null : (
                  <Pressable onPress={() => router.push('/add-garment')} accessibilityRole="button" accessibilityLabel="Thêm món" style={styles.item}>
                    <View style={[styles.itemThumb, styles.addThumb]}>
                      <Icon ios="plus" android="add" size={20} color={colors.inkSecondary} />
                    </View>
                    <Text variant="caption" color={colors.inkSecondary} style={{ fontSize: 11 }}>Thêm món</Text>
                  </Pressable>
                )
              }
            />
          ) : (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {(['formal', 'casual'] as const).map((section) => (
                  <Pressable key={section} onPress={() => setOutfitSection(section)} accessibilityRole="radio" accessibilityState={{ checked: outfitSection === section }} style={[styles.chip, outfitSection === section && { backgroundColor: colors.accent }]}>
                    <Text variant="footnote" color={outfitSection === section ? '#FFFFFF' : colors.ink}>{section === 'formal' ? 'Âu phục' : 'Thường ngày'}</Text>
                  </Pressable>
                ))}
              </View>
              <FlatList
                horizontal
                data={outfitSection === 'formal' ? DEMO_OUTFITS : CASUAL_OUTFITS}
                keyExtractor={(o) => o.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => <OutfitItem outfit={item} on={outfitSelected(item)} onPress={() => wearOutfit(item)} />}
              />
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
            {[...OCCASIONS, 'Khác'].map((o) => {
              const on = o === 'Khác' ? custom : !custom && occasion === o;
              return (
                <Pressable
                  key={o}
                  onPress={() => {
                    setCustom(o === 'Khác');
                    setOccasion(o === 'Khác' ? '' : o);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.chip, on && { backgroundColor: colors.accent }]}>
                  <Text variant="callout" color={on ? '#FFFFFF' : colors.ink}>{o}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {custom ? (
            <TextInput
              value={occasion}
              onChangeText={setOccasion}
              placeholder="Ví dụ: đám cưới bạn thân, phỏng vấn…"
              placeholderTextColor={colors.inkTertiary}
              maxLength={120}
              accessibilityLabel="Dịp khác"
              style={styles.input}
            />
          ) : null}

          {activeJob ? <ActiveJobBanner id={activeJob.id} /> : null}
          <Button
            label={modelPhoto ? 'Thử lên ảnh của tôi' : 'Thêm ảnh người mẫu để thử'}
            onPress={tryOn}
            loading={create.isPending}
            disabled={!!modelPhoto && (forTryOn.length === 0 || tooMany || !occasion.trim())}
            icon={<Icon ios="sparkles" android="auto_awesome" size={18} color="#FFFFFF" />}
          />
          {create.isError ? <Text variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>{messageFor(create.error)}</Text> : null}
        </Glass>
      </View>
    </TabScreenFrame>
  );
}

function TrayItem({ item, on, onPress }: { item: Wearable; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={item.label} style={styles.item}>
      <View style={[styles.itemThumb, on && styles.itemOn]}>
        {item.thumb ? (
          <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} />
        ) : item.sprite ? (
          <Image source={item.sprite.source} style={styles.inset} contentFit="contain" recyclingKey={item.id} />
        ) : null}
        {item.sprite && item.garmentId ? <View style={styles.pngDot} accessibilityLabel="Có hình cho ma nơ canh" /> : null}
      </View>
      <Text variant="caption" numberOfLines={1} style={{ fontSize: 11 }}>{item.label}</Text>
    </Pressable>
  );
}

function OutfitItem({ outfit, on, onPress }: { outfit: DemoOutfit; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${outfit.label}, ${outfit.bodyKey ? `người mẫu ${outfit.bodyKey === 'f' ? 'nữ' : 'nam'}` : `${outfit.members.length} món, giữ dáng hiện tại`}`} style={styles.item}>
      <View style={[styles.itemThumb, on && styles.itemOn]}>
        {outfit.image ? <Image source={outfit.image} style={styles.inset} contentFit="contain" /> : (
          <View style={styles.outfitGrid}>
            {outfit.members.map((w) => <Image key={w.id} source={w.sprite?.source} style={{ width: '50%', height: '50%' }} contentFit="contain" />)}
          </View>
        )}
      </View>
      <Text variant="caption" numberOfLines={1} style={{ fontSize: 11 }}>{outfit.label}</Text>
    </Pressable>
  );
}

/** Lets the user leave the waiting screen and come back to the running (or finished) try-on. */
function ActiveJobBanner({ id }: { id: string }) {
  const job = useTryOnJob(id);
  const status = job.data?.status;
  const label = status === 'done' ? 'Ảnh thử đồ đã xong' : status === 'failed' ? 'Lượt thử chưa thành công' : 'Đang thử đồ…';
  return (
    <Pressable onPress={() => router.push({ pathname: '/try-on/[jobId]', params: { jobId: id } })} accessibilityRole="button" style={styles.jobBanner}>
      {status === 'done' ? (
        <Icon ios="checkmark.circle.fill" android="check_circle" size={18} color={colors.success} />
      ) : status === 'failed' ? (
        <Icon ios="exclamationmark.circle.fill" android="error" size={18} color={colors.warning} />
      ) : (
        <ActivityIndicator size="small" color={colors.accent} />
      )}
      <Text variant="callout" style={{ flex: 1, fontWeight: '600' }}>{label}</Text>
      <Text variant="callout" color={colors.accent} style={{ fontWeight: '600' }}>Xem</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outfitGrid: { flex: 1, padding: 4, flexDirection: 'row', flexWrap: 'wrap' },
  jobBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.85)' },
  root: { flex: 1, backgroundColor: colors.studio },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.xl, paddingTop: space.sm, zIndex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, minHeight: 220 },
  stageBar: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill },
  segmentItem: { height: 30, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
  hint: { height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheet: { marginHorizontal: space.sm, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  tab: { height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.75)' },
  tabOn: { backgroundColor: colors.ink },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  item: { width: 72, alignItems: 'center', gap: 4 },
  itemThumb: { width: 72, height: 72, borderRadius: radius.md + 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.8)' },
  itemOn: { borderWidth: 2.5, borderColor: colors.accent },
  inset: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4 },
  pngDot: { position: 'absolute', right: 5, top: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  source: { flexDirection: 'row', padding: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.75)' },
  sourceItem: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.85)' },
  addThumb: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)' },
  input: { ...type.callout, height: 42, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: space.md, color: colors.ink },
});
