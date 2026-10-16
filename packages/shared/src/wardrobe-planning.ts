import { z } from 'zod';
export const CalendarDate = z.iso.date().refine(v => v >= '1900-01-01' && v <= '2099-12-31');
export const CalendarTimeZone = z.string().min(1).max(100).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}).transform(value => new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone);
export const CalendarDateParams = z.strictObject({ date: CalendarDate });
export const CalendarZoneQuery = z.strictObject({ timeZone: CalendarTimeZone });
export const PlannerWeekQuery = CalendarZoneQuery.extend({ startDate: CalendarDate })
  .refine(v => new Date(new Date(v.startDate).getTime() + 6 * 86400000).toISOString().slice(0, 10) <= '2099-12-31');
export const PutPlannerDayRequest = CalendarZoneQuery.extend({ occasion: z.string().trim().min(1).max(120), outfitId: z.uuid().nullable() });
export const PlannerDayResponse = z.strictObject({ date: CalendarDate, timeZone: CalendarTimeZone, isPlanned: z.boolean(), occasion: z.string().min(1).max(120).nullable(), outfitId: z.uuid().nullable(), outfitUnavailable: z.boolean() });
export const PlannerWeekResponse = z.strictObject({ startDate: CalendarDate, timeZone: CalendarTimeZone, days: z.array(PlannerDayResponse).length(7) });
export const PutWearRecordRequest = CalendarZoneQuery.extend({ date: CalendarDate, outfitId: z.uuid() });
export const WearRecordResponse = z.strictObject({ id: z.uuid(), date: CalendarDate, timeZone: CalendarTimeZone, outfitId: z.uuid().nullable(), garmentCount: z.number().int().min(1).max(4), createdAt: z.iso.datetime() });
export const WardrobePeriodQuery = z.strictObject({ from: CalendarDate, to: CalendarDate })
  .refine(v => v.to >= v.from && new Date(v.to).getTime() - new Date(v.from).getTime() <= 365 * 86400000);
export const WearHistoryResponse = z.strictObject({ items: z.array(WearRecordResponse).max(1830) });
export const PlanningDeleteResponse = z.strictObject({ deleted: z.literal(true) });
const count = z.number().int().nonnegative();
const insightItem = z.strictObject({ garmentId: z.uuid(), wearCount: count, lastWornOn: CalendarDate.nullable() });
export const WardrobeInsightsResponse = z.strictObject({ from: CalendarDate, to: CalendarDate, status: z.enum(['insufficient_data', 'available']), confirmedRecords: count, recordedDays: count, wardrobeGarments: count, garmentsWithoutRecords: count, mostWorn: z.array(insightItem).max(10), leastWorn: z.array(insightItem).max(10), revisitOutfitIds: z.array(z.uuid()).max(3) });
export type PlannerWeekQuery = z.infer<typeof PlannerWeekQuery>;
export type PutPlannerDayRequest = z.infer<typeof PutPlannerDayRequest>;
export type PutWearRecordRequest = z.infer<typeof PutWearRecordRequest>;
export type WardrobePeriodQuery = z.infer<typeof WardrobePeriodQuery>;
export const PLANNER_DAY_LIMIT = 730;
export const WEAR_RECORDS_PER_DAY = 5;
