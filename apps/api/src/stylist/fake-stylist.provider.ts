import { StylistAdvice, SuggestOutput } from '@stylist/shared';
import { StylistProvider, StylistContext } from './stylist.provider';
export class FakeStylistProvider extends StylistProvider {
  readonly name = 'fake' as const;
  readonly model = 'fake';
  advice(context: StylistContext): Promise<StylistAdvice> {
    return Promise.resolve({
      summary: 'Tư vấn mô phỏng để kiểm tra luồng.',
      strengths: ['Bộ đồ có các lớp dễ phối.'],
      adjustments:
        context.adviceLevel === 'advanced'
          ? [
              {
                suggestion: 'Thử cân bằng lớp ngoài với lớp trong.',
                reason: 'Gợi ý mô phỏng về tỷ lệ, chưa phân tích ảnh thật.',
              },
            ]
          : [],
      accessories:
        context.adviceLevel === 'advanced'
          ? [
              {
                type: 'túi',
                description: 'Túi dáng gọn mô phỏng',
                color: 'trung tính',
                reason: 'Gợi ý mô phỏng để kiểm tra tư vấn nâng cao.',
              },
            ]
          : [],
      occasionFit: {
        score: 3,
        reason: 'Dữ liệu thử nghiệm, chưa đánh giá ảnh thật.',
      },
    });
  }
  suggest(context: StylistContext): Promise<SuggestOutput> {
    const dresses = context.garments.filter((g) => g.tags.slot === 'dress');
    const tops = context.garments.filter((g) => g.tags.slot === 'top');
    const bottoms = context.garments.filter((g) => g.tags.slot === 'bottom');
    const sets = [
      ...dresses.map((g) => [g.id]),
      ...tops.flatMap((t) => bottoms.map((b) => [t.id, b.id])),
    ].slice(0, 3);
    return Promise.resolve({
      outfits: sets.map((garmentIds) => ({
        garmentIds,
        reason: 'Gợi ý mô phỏng từ tủ đồ để kiểm tra luồng.',
      })),
      message:
        sets.length < 3 ? 'Chưa đủ món để tạo ba tổ hợp khác nhau.' : null,
    });
  }
}
