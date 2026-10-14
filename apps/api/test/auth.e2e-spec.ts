import { PrivacyProcessor } from '../src/privacy/privacy.processor';
import { PrivacyService } from '../src/privacy/privacy.service';
import { RateLimitGuard } from '../src/usage/rate-limit.guard';
import { UsageService } from '../src/usage/usage.service';
import { PlanService } from '../src/usage/plan.service';
import { UsageResponse, AccountDeletionResponse } from '@stylist/shared';
import { StylistProcessor } from '../src/stylist/stylist.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ApiError, MeResponse } from '@stylist/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RuntimeConfig } from '../src/config/runtime-config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/queue/redis.service';
import { IdentityProvider } from '../src/auth/identity.provider';
import { UsersRepository } from '../src/auth/users.repository';
import { getQueueToken } from '@nestjs/bullmq';
import { AnalysisProcessor } from '../src/media/analysis.processor';

describe('Clerk boundary (HTTP)', () => {
  let app: INestApplication<App>;
  const user = {
    id: '6aac5ae9-f260-44ec-9554-c7c608120028',
    clerkUserId: 'user_verified',
    email: 'user@example.com',
    createdAt: new Date('2026-10-10T00:00:00Z'),
    clerkUpdatedAt: 1n,
    deletedAt: null,
  };
  const identity = {
    verifyToken: jest.fn(),
    getUser: jest.fn(),
    verifyWebhook: jest.fn(),
  };
  const users = { find: jest.fn(), sync: jest.fn() };
  const plans = { invalidate: jest.fn().mockResolvedValue(undefined) };
  const privacy = { request: jest.fn(), status: jest.fn() };
  const quota = {
    get: jest.fn().mockResolvedValue({
      plan: 'free',
      limit: 5,
      used: 5,
      remaining: 0,
      resetsAt: '2026-11-01T00:00:00Z',
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({ values: {} })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PrivacyProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('privacy'))
      .useValue({ add: jest.fn() })
      .overrideProvider(PrivacyService)
      .useValue(privacy)
      .overrideProvider(PlanService)
      .useValue(plans)
      .overrideProvider(UsageService)
      .useValue(quota)
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        onModuleInit: async () => {},
        onModuleDestroy: () => {},
      })
      .overrideProvider(IdentityProvider)
      .useValue(identity)
      .overrideProvider(UsersRepository)
      .useValue(users)
      .overrideProvider(getQueueToken('analysis'))
      .useValue({ add: jest.fn() })
      .overrideProvider(AnalysisProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('try-on'))
      .useValue({ add: jest.fn() })
      .overrideProvider(TryOnProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('garment-assets'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('stylist'))
      .useValue({})
      .overrideProvider(StylistProcessor)
      .useValue({})
      .overrideProvider(AssetProcessor)
      .useValue({})
      .compile();
    app = module.createNestApplication({ rawBody: true });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    identity.verifyToken.mockResolvedValue(user.clerkUserId);
    users.find.mockResolvedValue(user);
    users.sync.mockResolvedValue(user);
    quota.get.mockResolvedValue({
      plan: 'free',
      limit: 5,
      used: 5,
      remaining: 0,
      resetsAt: '2026-11-01T00:00:00Z',
    });
  });

  it.each([undefined, 'Basic secret', 'Bearer', 'Bearer x extra'])(
    'rejects missing/malformed Authorization %s',
    async (authorization) => {
      const req = request(app.getHttpServer()).get('/me');
      if (authorization) req.set('Authorization', authorization);
      const response = await req.expect(401);
      expect(ApiError.parse(response.body).code).toBe('UNAUTHORIZED');
      expect(identity.verifyToken).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid tokens and does not query users', async () => {
    identity.verifyToken.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer bad')
      .expect(401);
    expect(users.find).not.toHaveBeenCalled();
  });

  it('derives the user from the verified token, ignoring client userId', async () => {
    const response = await request(app.getHttpServer())
      .get('/me?userId=user_attacker')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(identity.verifyToken).toHaveBeenCalledWith('valid');
    expect(users.find).toHaveBeenCalledWith('user_verified');
    expect(MeResponse.parse(response.body)).toEqual({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('clerkUserId');
  });

  it('creates a missing local user from server-side Clerk profile', async () => {
    users.find.mockResolvedValue(null);
    const profile = { clerkUserId: 'user_verified', email: null, updatedAt: 2 };
    identity.getUser.mockResolvedValue(profile);
    users.sync.mockResolvedValue({ ...user, email: null });
    const response = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(users.sync).toHaveBeenCalledWith(profile);
    expect(MeResponse.parse(response.body).email).toBeNull();
  });

  it('does not authenticate deleted users', async () => {
    users.find.mockResolvedValue({ ...user, deletedAt: new Date() });
    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer valid')
      .expect(401);
    expect(identity.getUser).not.toHaveBeenCalled();
  });

  it('public health does not require authentication', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    expect(identity.verifyToken).not.toHaveBeenCalled();
  });
  it('usage is authenticated and uses the verified user, not client plan', async () => {
    await request(app.getHttpServer()).get('/usage').expect(401);
    const response = await request(app.getHttpServer())
      .get('/usage?plan=pro')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(UsageResponse.parse(response.body).remaining).toBe(0);
    expect(quota.get).toHaveBeenCalledWith(user.id);
  });
  it('only deletion routes permit a valid deleted user session to retry/status', async () => {
    users.find.mockResolvedValue({ ...user, deletedAt: new Date() });
    const receipt = { deletionId: user.id, status: 'queued' };
    privacy.request.mockResolvedValue(receipt);
    privacy.status.mockResolvedValue(receipt);
    for (let n = 0; n < 2; n++) {
      const response = await request(app.getHttpServer())
        .delete('/me')
        .set('Authorization', 'Bearer valid')
        .expect(202);
      expect(AccountDeletionResponse.parse(response.body).deletionId).toBe(
        user.id,
      );
    }
    await request(app.getHttpServer())
      .get('/me/deletion')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    await request(app.getHttpServer())
      .get('/usage')
      .set('Authorization', 'Bearer valid')
      .expect(401);
    await request(app.getHttpServer()).delete('/me').expect(401);
  });
  it('verified user billing events invalidate the plan cache; org events do not grant user rights', async () => {
    plans.invalidate.mockClear();
    identity.verifyWebhook.mockResolvedValue({
      type: 'subscriptionItem.canceled',
      data: { payer: { user_id: 'user_verified' } },
    });
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .send({})
      .expect(200);
    expect(plans.invalidate).toHaveBeenCalledWith('user_verified');
    plans.invalidate.mockClear();
    identity.verifyWebhook.mockResolvedValue({
      type: 'subscription.active',
      data: { payer: { organization_id: 'org_fixture' } },
    });
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .send({})
      .expect(200);
    expect(plans.invalidate).not.toHaveBeenCalled();
  });

  it('rejects unverified webhooks before touching persistence', async () => {
    identity.verifyWebhook.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .send({ type: 'user.deleted' })
      .expect(401);
    expect(users.sync).not.toHaveBeenCalled();
  });

  it('passes exact raw body and Svix headers to verification, then syncs updates', async () => {
    const event = {
      type: 'user.updated',
      data: {
        id: 'user_verified',
        updated_at: 123,
        primary_email_address_id: 'email_1',
        email_addresses: [{ id: 'email_1', email_address: 'new@example.com' }],
      },
    };
    identity.verifyWebhook.mockResolvedValue(event);
    const raw = JSON.stringify(event, null, 2);
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'event_1')
      .send(raw)
      .expect(200, { received: true });
    const calls = identity.verifyWebhook.mock.calls as [Request][];
    const forwarded = calls[0][0];
    expect(await forwarded.text()).toBe(raw);
    expect(forwarded.headers.get('svix-id')).toBe('event_1');
    expect(users.sync).toHaveBeenCalledWith({
      clerkUserId: 'user_verified',
      email: 'new@example.com',
      updatedAt: 123,
    });
  });

  it('scrubs deleted users and rejects malformed signed user events', async () => {
    identity.verifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      timestamp: 200,
      data: { id: 'user_verified', deleted: true },
    });
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .send({})
      .expect(200);
    expect(users.sync).toHaveBeenCalledWith(
      { clerkUserId: 'user_verified', email: null, updatedAt: 200 },
      true,
    );
    users.sync.mockClear();
    identity.verifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: {},
    });
    await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .send({})
      .expect(400);
    expect(users.sync).not.toHaveBeenCalled();
  });
});
