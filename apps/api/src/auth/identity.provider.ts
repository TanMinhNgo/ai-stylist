export interface IdentityUser {
  clerkUserId: string;
  email: string | null;
  updatedAt: number;
}

export abstract class IdentityProvider {
  abstract verifyToken(token: string): Promise<string>;
  abstract getUser(clerkUserId: string): Promise<IdentityUser>;
  abstract verifyWebhook(request: Request): Promise<unknown>;
}
