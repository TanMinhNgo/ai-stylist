import { z } from 'zod';

export const MeResponse = z.strictObject({
  id: z.uuid(),
  email: z.email().nullable(),
  createdAt: z.iso.datetime(),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const WebhookAckResponse = z.strictObject({ received: z.literal(true) });
export type WebhookAckResponse = z.infer<typeof WebhookAckResponse>;

const ClerkUserData = z.object({
  id: z.string().startsWith('user_'),
  updated_at: z.number().int().nonnegative(),
  primary_email_address_id: z.string().nullable(),
  email_addresses: z.array(z.object({ id: z.string(), email_address: z.email() })),
});

export const ClerkUserWebhook = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user.created'), data: ClerkUserData }),
  z.object({ type: z.literal('user.updated'), data: ClerkUserData }),
  z.object({
    type: z.literal('user.deleted'),
    timestamp: z.number().int().nonnegative(),
    data: z.object({ id: z.string().startsWith('user_'), deleted: z.literal(true) }),
  }),
]);
export type ClerkUserWebhook = z.infer<typeof ClerkUserWebhook>;
