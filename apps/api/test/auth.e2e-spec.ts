import { PrivacyProcessor } from '../src/privacy/privacy.processor';
import { PrivacyService } from '../src/privacy/privacy.service';
import { RateLimitGuard } from '../src/usage/rate-limit.guard';
import { UsageService } from '../src/usage/usage.service';
import { PlanService } from '../src/usage/plan.service';
import { StylistRepository } from '../src/stylist/stylist.repository';
import { CollectionsRepository } from '../src/collections/collections.repository';
import { PlanningRepository } from '../src/planning/planning.repository';
import { InsightsRepository } from '../src/planning/insights.repository';
import {
  UsageResponse,
  AccountDeletionResponse,
  EntitlementsResponse,
  PLAN_FEATURES,
  StylistUsageResponse,
} from '@stylist/shared';
import { StylistProcessor } from '../src/stylist/stylist.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
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
  const stylist = { usage: jest.fn() };
  const planning = {
    week: jest.fn(),
    putDay: jest.fn(),
    removeDay: jest.fn(),
    wear: jest.fn(),
    history: jest.fn(),
    removeWear: jest.fn(),
  };
  const insights = { get: jest.fn() };
  const collections = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const quota = {
    requireFeature: jest.fn(),
    getEntitlements: jest.fn(),
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
      .overrideProvider(StylistRepository)
      .useValue(stylist)
      .overrideProvider(CollectionsRepository)
      .useValue(collections)
      .overrideProvider(PlanningRepository)
      .useValue(planning)
      .overrideProvider(InsightsRepository)
      .useValue(insights)
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
  it('planner/history/insights require authentication and validate local calendar inputs', async () => {
    for (const path of ['/planner/week', '/wear-history', '/wardrobe/insights'])
      await request(app.getHttpServer()).get(path).expect(401);
    const auth = { Authorization: 'Bearer valid' };
    await request(app.getHttpServer())
      .get('/planner/week?startDate=2026-02-30&timeZone=UTC')
      .set(auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/planner/week?startDate=2026-10-17&timeZone=Mars')
      .set(auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/wear-history?from=2026-10-17&to=2026-10-16')
      .set(auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/wardrobe/insights?from=2026-01-01&to=2028-01-01')
      .set(auth)
      .expect(400);
  });
  it('paid gates block planner mutation/insights but leave archived reads and deletes available', async () => {
    quota.requireFeature.mockRejectedValue(new ForbiddenException());
    const auth = { Authorization: 'Bearer valid' };
    await request(app.getHttpServer())
      .put('/planner/days/2026-10-17')
      .set(auth)
      .send({ timeZone: 'UTC', occasion: 'Work', outfitId: null })
      .expect(403);
    await request(app.getHttpServer())
      .get('/wardrobe/insights?from=2026-10-01&to=2026-10-17')
      .set(auth)
      .expect(403);
    expect(planning.putDay).not.toHaveBeenCalled();
    expect(insights.get).not.toHaveBeenCalled();
    planning.week.mockResolvedValue({ days: [] });
    planning.removeDay.mockResolvedValue({ deleted: true });
    await request(app.getHttpServer())
      .get('/planner/week?startDate=2026-10-17&timeZone=UTC')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete('/planner/days/2026-10-17?timeZone=UTC')
      .set(auth)
      .expect(200);
    expect(planning.week).toHaveBeenCalledWith(user.id, {
      startDate: '2026-10-17',
      timeZone: 'UTC',
    });
  });
  it('wear confirmation scopes IDs to the token and rejects injected owner/plan', async () => {
    const auth = { Authorization: 'Bearer valid' },
      body = { date: '2026-10-17', timeZone: 'UTC', outfitId: user.id };
    planning.wear.mockResolvedValue({ id: user.id });
    await request(app.getHttpServer())
      .put(`/wear-history/${user.id}`)
      .set(auth)
      .send(body)
      .expect(200);
    expect(planning.wear).toHaveBeenCalledWith(user.id, user.id, body);
    await request(app.getHttpServer())
      .put(`/wear-history/${user.id}`)
      .set(auth)
      .send({ ...body, userId: user.id })
      .expect(400);
    await request(app.getHttpServer())
      .put('/wear-history/not-a-uuid')
      .set(auth)
      .send(body)
      .expect(400);
  });
  it('collections authenticate and derive ownership from token', async () => {
    await request(app.getHttpServer()).get('/collections').expect(401);
    collections.list.mockResolvedValue({ items: [], nextCursor: null });
    await request(app.getHttpServer())
      .get('/collections')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(collections.list).toHaveBeenCalledWith(user.id, { limit: 20 });
    await request(app.getHttpServer())
      .get('/collections?userId=attacker')
      .set('Authorization', 'Bearer valid')
      .expect(400);
  });
  it('collections reject forged membership, empty patches and malformed IDs', async () => {
    const auth = { Authorization: 'Bearer valid' };
    await request(app.getHttpServer())
      .post('/collections')
      .set(auth)
      .send({ name: 'Test', occasion: 'Work', plan: 'pro' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/collections/${user.id}`)
      .set(auth)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/collections/bad')
      .set(auth)
      .expect(400);
    expect(collections.create).not.toHaveBeenCalled();
  });
  it('collections require a verified paid feature for create/edit but allow archived reads/deletion', async () => {
    quota.requireFeature.mockRejectedValue(
      new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Feature not included',
      }),
    );
    const auth = { Authorization: 'Bearer valid' };
    await request(app.getHttpServer())
      .post('/collections')
      .set(auth)
      .send({ name: 'Work', occasion: 'Work' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/collections/${user.id}`)
      .set(auth)
      .send({ name: 'Changed' })
      .expect(403);
    expect(collections.create).not.toHaveBeenCalled();
    expect(collections.update).not.toHaveBeenCalled();
    collections.get.mockResolvedValue({ id: user.id });
    collections.remove.mockResolvedValue({ deleted: true });
    await request(app.getHttpServer())
      .get(`/collections/${user.id}`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/collections/${user.id}`)
      .set(auth)
      .expect(200, { deleted: true });
    expect(collections.remove).toHaveBeenCalledWith(user.id, user.id);
    expect(quota.requireFeature).toHaveBeenCalledWith(
      user.id,
      'occasion_collections',
    );
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
  it('stylist usage requires authentication and ignores client plan, level and userId', async () => {
    stylist.usage.mockResolvedValue({
      plan: 'free',
      adviceLevel: 'basic',
      limit: 10,
      used: 2,
      remaining: 8,
      period: 'calendar_month_utc',
      resetsAt: '2026-11-01T00:00:00Z',
    });
    await request(app.getHttpServer()).get('/stylist/usage').expect(401);
    const response = await request(app.getHttpServer())
      .get('/stylist/usage?plan=pro&adviceLevel=advanced&userId=attacker')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(StylistUsageResponse.parse(response.body).adviceLevel).toBe('basic');
    expect(stylist.usage).toHaveBeenCalledWith(user.id);
  });
  it('entitlements ignore client-supplied plan, features and userId', async () => {
    quota.getEntitlements.mockResolvedValue({
      plan: 'free',
      includedFeatures: PLAN_FEATURES.free,
      availableFeatures: PLAN_FEATURES.free,
      tryOn: {
        limit: 5,
        period: 'calendar_month_utc',
        resetsAt: '2026-11-01T00:00:00Z',
      },
    });
    await request(app.getHttpServer()).get('/usage/entitlements').expect(401);
    const response = await request(app.getHttpServer())
      .get(
        '/usage/entitlements?plan=pro&feature=priority_queue&userId=attacker',
      )
      .set('Authorization', 'Bearer valid')
      .expect(200);
    const access = EntitlementsResponse.parse(response.body);
    expect(access.plan).toBe('free');
    expect(access.availableFeatures).not.toContain('priority_queue');
    expect(quota.getEntitlements).toHaveBeenCalledWith(user.id);
    users.find.mockResolvedValue({ ...user, deletedAt: new Date() });
    await request(app.getHttpServer())
      .get('/usage/entitlements')
      .set('Authorization', 'Bearer valid')
      .expect(401);
  });
  it('does not grant entitlements when billing is unavailable or leak provider errors', async () => {
    quota.getEntitlements.mockRejectedValue(
      new ServiceUnavailableException('private provider detail'),
    );
    const response = await request(app.getHttpServer())
      .get('/usage/entitlements')
      .set('Authorization', 'Bearer valid')
      .expect(503);
    expect(JSON.stringify(response.body)).not.toContain(
      'private provider detail',
    );
    expect(response.body).not.toHaveProperty('availableFeatures');
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
