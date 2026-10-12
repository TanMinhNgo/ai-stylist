import type { AssetInput, BodyKey, IdeaProposal } from '@stylist/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { Section } from '@/features/assets/AddFromPhoto';
import { useAssetJob, useAssetQuota, useCreateAssetJobs, useCreateIdea, useIdeaJob } from '@/features/assets/hooks';
import { ALL_TYPES, ideaRequest, keyFor, quotaProblem, typesFor, type GenType, type HeldKey, type MenuId } from '@/features/assets/logic';
import { BodySwitch, Chips, QuotaLine, TypePicker, typeChips } from '@/features/assets/pickers';
import { TYPE_LABEL } from '@/features/garments/labels';
import { newIdempotencyKey } from '@/features/try-on/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

type Draft = IdeaProposal & { selected: boolean };

/** Describe → AI proposes up to 4 pieces (no image yet) → user edits/selects → confirm spends one generation per piece. */
export function AddFromIdea({ initialBody }: { initialBody: BodyKey }) {
  const [menu, setMenu] = useState<MenuId>('outfit');
  const [kind, setKind] = useState<GenType | null>(null);
  const [body, setBody] = useState(initialBody);
  const [prompt, setPrompt] = useState('');
  const [ideaKey, setIdeaKey] = useState<HeldKey | null>(null);
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<{ id: string; items: Draft[] } | null>(null);
  const [batchKey, setBatchKey] = useState<HeldKey | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);

  const quota = useAssetQuota();
  const createIdea = useCreateIdea();
  const { query: idea, stuck: planStuck } = useIdeaJob(ideaId);
  const createJobs = useCreateAssetJobs();

  const input = ideaRequest(menu, kind, prompt, body);
  const plansLeft = quota.data?.ideaPlansRemaining ?? 0;

  function propose(fresh: boolean) {
    if (!input) return;
    // Same request (e.g. retry after a lost response) keeps its key; "Gợi ý khác" asks for a new plan on purpose.
    const held = keyFor(fresh ? null : ideaKey, input, newIdempotencyKey);
    setIdeaKey(held);
    setJobIds([]);
    createIdea.mutate({ input, key: held.key }, { onSuccess: ({ jobId }) => setIdeaId(jobId) });
  }

  // Proposals become editable drafts once, when that plan is ready.
  const plan = idea.data;
  useEffect(() => {
    if (plan?.status === 'ready' && drafts?.id !== plan.id) setDrafts({ id: plan.id, items: plan.items.map((p) => ({ ...p, selected: true })) });
  }, [plan, drafts?.id]);

  const chosen = drafts?.items.filter((d) => d.selected && d.prompt.trim()) ?? [];
  const problem = chosen.length ? quotaProblem(quota.data, chosen.length) : null;
  const items: AssetInput[] = chosen.map((d) => ({ source: 'idea', type: d.type, prompt: d.prompt.trim(), bodyKey: body }));

  function generate(fresh: boolean) {
    if (!items.length || problem) return;
    const held = keyFor(fresh ? null : batchKey, items, newIdempotencyKey);
    setBatchKey(held);
    createJobs.mutate({ items, key: held.key }, { onSuccess: ({ jobIds: ids }) => setJobIds(ids) });
  }

  const edit = (i: number, patch: Partial<Draft>) => setDrafts((d) => d && { ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <View style={{ gap: space.lg }}>
      <Section title="1. Bạn muốn món gì?">
        <TypePicker
          outfit
          menu={menu}
          type={kind}
          onMenu={(m) => {
            setMenu(m);
            setKind(typesFor(m)[0] ?? null);
          }}
          onType={setKind}
        />
        <BodySwitch value={body} onChange={setBody} />
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={menu === 'outfit' ? 'Ví dụ: bộ đi làm thanh lịch tông be, mặc được mùa hè' : 'Ví dụ: sơ mi lụa trắng cổ đức, tay dài'}
          placeholderTextColor={colors.inkTertiary}
          multiline
          maxLength={1000}
          accessibilityLabel="Mô tả ý tưởng"
          style={styles.input}
        />
        <Text variant="footnote" color={colors.inkSecondary}>
          {menu === 'outfit' ? 'AI đề xuất tối đa 4 món để bạn chọn, chưa tạo hình nên chưa tốn lượt.' : 'AI đề xuất 1 món để bạn sửa trước khi tạo hình.'}
          {quota.data?.enabled ? ` Còn ${plansLeft} lần gợi ý hôm nay.` : ''}
        </Text>
        <QuotaLine quota={quota.data} />
        <Button
          label="Gợi ý món"
          variant="ink"
          onPress={() => propose(false)}
          loading={createIdea.isPending}
          disabled={!input || !quota.data?.enabled || !plansLeft}
          icon={<Icon ios="wand.and.stars" android="auto_fix_high" size={18} color="#FFFFFF" />}
        />
        {createIdea.isError ? <Text variant="footnote" color={colors.danger}>{messageFor(createIdea.error)}</Text> : null}
      </Section>

      {ideaId ? (
        <Section title="2. Chọn và chỉnh đề xuất">
          {!plan || plan.status === 'queued' || plan.status === 'processing' ? (
            planStuck ? (
              <>
                <Text variant="callout" color={colors.inkSecondary}>AI lên ý tưởng lâu hơn dự kiến.</Text>
                <Button label="Kiểm tra lại" variant="plain" onPress={() => idea.refetch()} />
              </>
            ) : (
              <View style={styles.row}>
                <ActivityIndicator color={colors.inkSecondary} />
                <Text variant="callout" color={colors.inkSecondary}>AI đang lên ý tưởng… (chưa tạo hình)</Text>
              </View>
            )
          ) : plan.status === 'failed' ? (
            <Text variant="callout" color={colors.danger}>{messageFor(new RequestError(plan.errorCode ?? 'ASSET_PROVIDER_ERROR'))}</Text>
          ) : idea.isError ? (
            <Text variant="callout" color={colors.danger}>{messageFor(idea.error)}</Text>
          ) : (
            <>
              {drafts?.items.map((d, i) => (
                <View key={i} style={[styles.draft, !d.selected && { opacity: 0.55 }]}>
                  <Pressable onPress={() => edit(i, { selected: !d.selected })} accessibilityRole="checkbox" accessibilityState={{ checked: d.selected }} style={styles.row} disabled={!!jobIds.length}>
                    <Icon ios={d.selected ? 'checkmark.circle.fill' : 'circle'} android={d.selected ? 'check_circle' : 'radio_button_unchecked'} size={22} color={d.selected ? colors.accent : colors.inkTertiary} />
                    <Text variant="callout" style={{ flex: 1, fontWeight: '600' }}>{d.label}</Text>
                    <Text variant="caption" color={colors.inkSecondary}>{TYPE_LABEL[d.type]}</Text>
                  </Pressable>
                  {d.selected && !jobIds.length ? (
                    <>
                      <Chips label="Loại món" items={typeChips(menu === 'outfit' ? ALL_TYPES : typesFor(menu))} value={d.type as GenType} onChange={(t) => edit(i, { type: t })} />
                      <TextInput value={d.prompt} onChangeText={(t) => edit(i, { prompt: t })} multiline maxLength={1000} accessibilityLabel={`Mô tả ${d.label}`} style={styles.input} />
                    </>
                  ) : null}
                </View>
              ))}
              {!jobIds.length ? (
                <>
                  <Text variant="callout" style={{ fontWeight: '600' }}>
                    Tạo {chosen.length} hình · cần {chosen.length} lượt{quota.data?.enabled ? `, còn ${quota.data.remaining}` : ''}
                  </Text>
                  {problem ? <Text variant="footnote" color={colors.warning}>{problem}</Text> : null}
                  <Button label="Xác nhận tạo hình" onPress={() => generate(false)} loading={createJobs.isPending} disabled={!items.length || !!problem} icon={<Icon ios="sparkles" android="auto_awesome" size={18} color="#FFFFFF" />} />
                  {createJobs.isError ? <Text variant="footnote" color={colors.danger}>{messageFor(createJobs.error)}</Text> : null}
                  <Button label="Gợi ý khác" variant="plain" onPress={() => propose(true)} disabled={!input || !plansLeft || createIdea.isPending} />
                </>
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {jobIds.length ? (
        <Section title="3. Đang tạo hình">
          {jobIds.map((id) => (
            <JobRow key={id} id={id} />
          ))}
          <Text variant="footnote" color={colors.inkSecondary}>Có thể rời màn này; món xong sẽ có trong Tủ đồ với nhãn AI concept.</Text>
          <Button label="Tạo lại lần nữa" variant="plain" onPress={() => generate(true)} loading={createJobs.isPending} disabled={!items.length || !!problem} />
        </Section>
      ) : null}
    </View>
  );
}

export function JobRow({ id }: { id: string }) {
  const { job, stuck } = useAssetJob(id);
  const j = job.data;
  const busy = !j || j.status === 'queued' || j.status === 'processing';
  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {j?.asset ? <Image source={{ uri: j.asset.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="contain" /> : busy && !stuck ? <ActivityIndicator color={colors.inkSecondary} /> : null}
      </View>
      <Text variant="callout" style={{ flex: 1 }} color={j?.status === 'failed' ? colors.danger : colors.ink}>
        {job.isError
          ? messageFor(job.error)
          : j?.status === 'failed'
            ? messageFor(new RequestError(j.errorCode ?? 'ASSET_PROVIDER_ERROR'))
            : j?.status === 'ready'
              ? 'Đã tạo xong'
              : stuck
                ? 'Lâu hơn dự kiến, xem lại sau trong Tủ đồ'
                : 'Đang tạo hình…'}
      </Text>
      {j?.status === 'ready' && j.garmentId ? <Button label="Xem" variant="plain" onPress={() => router.push({ pathname: '/garment/[id]', params: { id: j.garmentId! } })} /> : null}
      {stuck ? <Button label="Kiểm tra" variant="plain" onPress={() => job.refetch()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { ...type.callout, minHeight: 72, borderRadius: radius.sm, backgroundColor: colors.ground, padding: space.md, color: colors.ink, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  draft: { gap: space.sm, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  thumb: { width: 56, height: 72, borderRadius: radius.sm, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
