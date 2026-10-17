import { Test } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import {
  ForbiddenException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { randomUUID, createHmac } from 'node:crypto';
import {
  BillingSessionResponse,
  PublicLookbookResponse,
} from '@stylist/shared';
import { ClerkAuthGuard } from '../src/auth/clerk-auth.guard';
import { AuthService } from '../src/auth/auth.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { RuntimeConfig } from '../src/config/runtime-config';
import { PlanService } from '../src/usage/plan.service';
import { UsageService } from '../src/usage/usage.service';
import { RateLimitGuard } from '../src/usage/rate-limit.guard';
import { BillingController } from '../src/usage/billing.controller';
import { BillingService } from '../src/usage/billing.service';
import { ContextController } from '../src/context/context.controller';
import { ContextRepository } from '../src/context/context.repository';
import { ContextService } from '../src/context/context.service';
import { AffiliateController } from '../src/affiliate/affiliate.controller';
import { AffiliateService } from '../src/affiliate/affiliate.service';
import { SharingController } from '../src/sharing/sharing.controller';
import { SharingRepository } from '../src/sharing/sharing.repository';
import { PublicShareGuard } from '../src/sharing/public-share.guard';
import { RedisService } from '../src/queue/redis.service';

describe('Phase7 HTTP trust boundaries', () => {
  let app: INestApplication<App>;
  const owner = randomUUID(),
    free = randomUUID(),
    id = randomUUID(),
    secret = 's'.repeat(32);
  const plans = {
    getUserPlan: jest.fn().mockResolvedValue('pro'),
    invalidate: jest.fn(),
  };
  const sharing = {
    create: jest.fn().mockResolvedValue({}),
    list: jest.fn().mockResolvedValue({ items: [] }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
    publicView: jest.fn().mockResolvedValue({
      title: 'Shared',
      expiresAt: '2026-10-24T00:00:00Z',
      imageUrlsExpireAt: '2026-10-17T12:01:00Z',
      outfits: [{ imageUrl: 'https://images.example/signed' }],
    }),
  };
  const events = {
    events: jest.fn().mockResolvedValue({ items: [] }),
    put: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
  };
  const context = {
    week: jest.fn().mockResolvedValue({}),
    export: jest.fn().mockResolvedValue({}),
  };
  const affiliate = {
    products: jest.fn().mockResolvedValue({ items: [] }),
    click: jest.fn().mockResolvedValue({ recorded: true }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        BillingController,
        ContextController,
        AffiliateController,
        SharingController,
      ],
      providers: [
        {
          provide: RedisService,
          useValue: {
            client: { eval: jest.fn().mockResolvedValue([1, 60000]) },
          },
        },
        BillingService,
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        {
          provide: AuthService,
          useValue: {
            currentUser: jest.fn((token: string) => {
              if (!['own', 'free'].includes(token))
                throw new UnauthorizedException();
              return Promise.resolve({
                id: token === 'own' ? owner : free,
                clerkUserId: 'user_owner',
              });
            }),
          },
        },
        {
          provide: RuntimeConfig,
          useValue: {
            values: {
              BILLING_PROVIDER: 'revenuecat',
              REVENUECAT_PLUS_ENTITLEMENT: 'plus',
              REVENUECAT_PRO_ENTITLEMENT: 'pro',
              REVENUECAT_WEBHOOK_SECRET: secret,
            },
          },
        },
        { provide: PlanService, useValue: plans },
        {
          provide: UsageService,
          useValue: {
            requireFeature: (uid: string) => {
              if (uid !== owner) throw new ForbiddenException();
              return Promise.resolve();
            },
          },
        },
        { provide: RateLimitGuard, useValue: { canActivate: () => true } },
        { provide: PublicShareGuard, useValue: { canActivate: () => true } },
        { provide: ContextRepository, useValue: events },
        { provide: ContextService, useValue: context },
        { provide: AffiliateService, useValue: affiliate },
        { provide: SharingRepository, useValue: sharing },
      ],
    }).compile();
    app = module.createNestApplication({ rawBody: true, logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('requires a valid live account for all private routes', async () => {
    for (const path of [
      '/billing/session',
      '/planner/context',
      '/calendar/events',
      '/planner/calendar-export',
      '/affiliate/products',
      `/collections/${id}/shares`,
    ])
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get('/billing/session')
      .auth('deleted', { type: 'bearer' })
      .expect(401);
  });
  it('session gives an authenticated SDK identity; sync rejects client authority and re-reads the server plan', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/session?plan=free')
      .auth('own', { type: 'bearer' })
      .expect(200);
    const session = BillingSessionResponse.parse(response.body);
    expect(session.appUserId).toBe('user_owner');
    expect(session.plan).toBe('pro');
    await request(app.getHttpServer())
      .post('/billing/sync')
      .auth('own', { type: 'bearer' })
      .send({ plan: 'pro' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/billing/sync')
      .auth('own', { type: 'bearer' })
      .send({})
      .expect(200, { plan: 'pro' });
    expect(plans.invalidate).toHaveBeenCalledWith('user_owner');
  });
  it('accepts only HMAC-verified webhooks; transfer and replay invalidate all relevant identities without granting a plan', async () => {
    const raw = JSON.stringify({
      api_version: '1.0',
      event: {
        id: 'event',
        type: 'TRANSFER',
        transferred_from: ['user_owner'],
        transferred_to: ['user_other'],
        new_vendor_field: true,
      },
    });
    const t = Math.floor(Date.now() / 1000),
      sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .send({})
      .expect(401);
    const before = plans.getUserPlan.mock.calls.length;
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/webhooks/revenuecat')
        .set('Content-Type', 'application/json')
        .set('X-RevenueCat-Webhook-Signature', `t=${t},v1=${sig}`)
        .send(raw)
        .expect(200, { received: true });
    expect(plans.invalidate).toHaveBeenCalledWith('user_other');
    expect(plans.getUserPlan.mock.calls).toHaveLength(before);
    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .set('Content-Type', 'application/json')
      .set('X-RevenueCat-Webhook-Signature', `t=${t},v1=${sig}`)
      .send(raw + ' ')
      .expect(401);
  });
  it('validates calendar UUIDs/date/coordinates and scopes mutations to token owner', async () => {
    const body = {
      date: '2026-10-17',
      timeZone: 'UTC',
      title: 'Work',
      occasion: 'work',
    };
    await request(app.getHttpServer())
      .put(`/calendar/events/${id}`)
      .auth('own', { type: 'bearer' })
      .send({ ...body, userId: free })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/calendar/events/${id}`)
      .auth('own', { type: 'bearer' })
      .send(body)
      .expect(200);
    expect(events.put).toHaveBeenCalledWith(owner, id, body);
    await request(app.getHttpServer())
      .get('/planner/context?startDate=2026-10-17&timeZone=UTC&latitude=10')
      .auth('own', { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/calendar/events?startDate=2026-02-30&timeZone=UTC')
      .auth('own', { type: 'bearer' })
      .expect(400);
  });
  it('affiliate tracking cannot accept arbitrary URLs or owner IDs', async () => {
    await request(app.getHttpServer())
      .put(`/affiliate/clicks/${id}`)
      .auth('own', { type: 'bearer' })
      .send({ productId: 'shoe', url: 'https://evil.example' })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/affiliate/clicks/${id}`)
      .auth('own', { type: 'bearer' })
      .send({ productId: 'shoe' })
      .expect(200, { recorded: true });
    expect(affiliate.click).toHaveBeenCalledWith(owner, id, 'shoe');
  });
  it('share creation requires the paid collection feature, public views need only capability and emit privacy headers', async () => {
    await request(app.getHttpServer())
      .post(`/collections/${id}/shares`)
      .auth('free', { type: 'bearer' })
      .send({ outfitIds: [randomUUID()] })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/collections/${id}/shares`)
      .auth('own', { type: 'bearer' })
      .send({ outfitIds: [] })
      .expect(400);
    const response = await request(app.getHttpServer())
      .get(`/shared-lookbooks/${'x'.repeat(43)}`)
      .expect(200);
    PublicLookbookResponse.parse(response.body);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-robots-tag']).toContain('noindex');
    await request(app.getHttpServer())
      .get('/shared-lookbooks/bad-token')
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/lookbook-shares/${id}`)
      .auth('free', { type: 'bearer' })
      .expect(200);
    expect(sharing.remove).toHaveBeenCalledWith(free, id);
  });
});
