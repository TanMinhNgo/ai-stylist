import { z } from 'zod';
import { Plan } from './usage';
import { GarmentType } from './wardrobe';
import { CalendarDate, CalendarTimeZone, PlannerWeekQuery } from './wardrobe-planning';

export const EmptyRequest = z.strictObject({});
export const BillingProvider = z.enum(['clerk', 'revenuecat']);
export const BillingSessionResponse = z.strictObject({
  provider: BillingProvider, enabled: z.boolean(), appUserId: z.string().nullable(),
  entitlementIds: z.strictObject({ plus: z.string(), pro: z.string() }).nullable(),
  plan: Plan, purchaseAndRestore: z.enum(['native_sdk', 'unavailable']),
  managementUrls: z.strictObject({ ios: z.url(), android: z.url() }).nullable(),
});
export const BillingSyncResponse = z.strictObject({ plan: Plan });
// Provider webhooks deliberately tolerate new vendor fields after signature verification.
export const RevenueCatWebhook = z.object({ api_version: z.literal('1.0'), event: z.object({
  id: z.string().min(1).max(255), type: z.string().min(1).max(100),
  app_user_id: z.string().max(255).optional(), aliases: z.array(z.string().max(255)).max(100).optional(),
  original_app_user_id: z.string().max(255).optional(),
  transferred_from: z.array(z.string().max(255)).max(100).optional(),
  transferred_to: z.array(z.string().max(255)).max(100).optional(),
}) });

export const PutCalendarEventRequest = z.strictObject({
  date: CalendarDate, timeZone: CalendarTimeZone,
  title: z.string().trim().min(1).max(120), occasion: z.string().trim().min(1).max(120),
});
export const CalendarEventResponse = PutCalendarEventRequest.extend({ id: z.uuid() });
export const CalendarEventsResponse = z.strictObject({ items: z.array(CalendarEventResponse).max(730) });
export const PlannerContextQuery = z.strictObject({
  startDate: CalendarDate, timeZone: CalendarTimeZone,
  latitude: z.preprocess(v => v === '' || Array.isArray(v) ? NaN : v, z.coerce.number().finite().min(-90).max(90)).optional(),
  longitude: z.preprocess(v => v === '' || Array.isArray(v) ? NaN : v, z.coerce.number().finite().min(-180).max(180)).optional(),
}).refine(v => PlannerWeekQuery.safeParse({ startDate: v.startDate, timeZone: v.timeZone }).success)
  .refine(v => (v.latitude === undefined) === (v.longitude === undefined));
export const WeatherDay = z.strictObject({
  date: CalendarDate, minC: z.number().min(-100).max(70), maxC: z.number().min(-100).max(70),
  rainProbability: z.number().min(0).max(100), code: z.number().int().min(0).max(99),
}).refine(v => v.minC <= v.maxC);
export const ClothingHint = z.enum(['light_layers', 'warm_layers', 'rain_protection']);
export const PlannerContextResponse = z.strictObject({
  startDate: CalendarDate, timeZone: CalendarTimeZone,
  weatherStatus: z.enum(['not_requested', 'disabled', 'unavailable', 'available']),
  weatherAttribution: z.string().nullable(),
  days: z.array(z.strictObject({ date: CalendarDate, events: z.array(CalendarEventResponse).max(730),
    weather: WeatherDay.nullable(), clothingHints: z.array(ClothingHint).max(3),
    suggestedOccasion: z.string().nullable(),
  })).length(7),
});
export const CalendarExportResponse = z.strictObject({
  fileName: z.string().endsWith('.ics'), contentType: z.literal('text/calendar'), content: z.string().max(100000),
});

export const AffiliateProductId = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const AffiliateProduct = z.strictObject({
  id: AffiliateProductId, name: z.string().trim().min(1).max(160),
  merchant: z.string().trim().min(1).max(100), type: GarmentType,
  url: z.url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }),
});
export const AffiliateCatalog = z.array(AffiliateProduct).max(500)
  .refine(items => new Set(items.map(p => p.id)).size === items.length);
export const AffiliateProductsQuery = z.strictObject({ type: GarmentType.optional(), q: z.string().trim().min(1).max(80).optional() });
export const AffiliateProductsResponse = z.strictObject({
  status: z.enum(['not_configured', 'available']), disclosure: z.string(), items: z.array(AffiliateProduct).max(50),
});
export const PutAffiliateClickRequest = z.strictObject({ productId: AffiliateProductId });
export const AffiliateClickResponse = z.strictObject({ recorded: z.literal(true) });

export const CreateLookbookShareRequest = z.strictObject({
  outfitIds: z.array(z.uuid()).min(1).max(50).refine(ids => new Set(ids).size === ids.length),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});
export const ShareTokenParams = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const LookbookShareResponse = z.strictObject({
  id: z.uuid(), collectionId: z.uuid(), expiresAt: z.iso.datetime(), createdAt: z.iso.datetime(),
});
export const CreateLookbookShareResponse = LookbookShareResponse.extend({ token: z.string().length(43), publicPath: z.string() });
export const LookbookSharesResponse = z.strictObject({ items: z.array(LookbookShareResponse).max(20) });
export const PublicLookbookResponse = z.strictObject({
  title: z.string().max(80), expiresAt: z.iso.datetime(), imageUrlsExpireAt: z.iso.datetime(),
  outfits: z.array(z.strictObject({ imageUrl: z.url() })).max(50),
});
export type PutCalendarEventRequest = z.infer<typeof PutCalendarEventRequest>;
export type PlannerContextQuery = z.infer<typeof PlannerContextQuery>;
export type AffiliateProductsQuery = z.infer<typeof AffiliateProductsQuery>;
export type CreateLookbookShareRequest = z.infer<typeof CreateLookbookShareRequest>;
export type WeatherDay = z.infer<typeof WeatherDay>;
