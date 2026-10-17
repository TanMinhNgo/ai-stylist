import { AffiliateService } from './affiliate.service';
import { AffiliateRepository } from './affiliate.repository';
import { RuntimeConfig } from '../config/runtime-config';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
it('lists only configured matching products and always discloses affiliate links', () => {
  const config = {
    values: {
      AFFILIATE_PRODUCTS_JSON: [
        {
          id: 'shoe',
          name: 'Giày',
          type: 'sneakers',
          merchant: 'Shop',
          url: 'https://shop.example/shoe',
        },
      ],
    },
  } as unknown as RuntimeConfig;
  const service = new AffiliateService(config, {} as AffiliateRepository);
  expect(service.products({ q: 'GIÀY' }).items).toHaveLength(1);
  expect(service.products({ q: 'missing' }).items).toHaveLength(0);
  expect(service.products({}).disclosure).toContain('hoa hồng');
  config.values.AFFILIATE_PRODUCTS_JSON = [];
  expect(service.products({}).status).toBe('not_configured');
});
it('deduplicates clicks before quota/catalog checks, rejects ID conflicts and limits new tracking', async () => {
  const affiliateClick = {
    findUnique: jest.fn(),
    count: jest.fn().mockResolvedValue(100),
    create: jest.fn(),
    deleteMany: jest.fn(),
  };
  const tx = { affiliateClick },
    lock = jest.fn();
  const repo = new AffiliateRepository(
    {
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService,
    { lock } as unknown as JobLimitsService,
  );
  affiliateClick.findUnique.mockResolvedValue({ productId: 'shoe' });
  await expect(repo.record('owner', 'id', 'shoe', false)).resolves.toEqual({
    recorded: true,
  });
  expect(affiliateClick.count).not.toHaveBeenCalled();
  await expect(repo.record('owner', 'id', 'bag', true)).rejects.toMatchObject({
    status: 409,
  });
  affiliateClick.findUnique.mockResolvedValue(null);
  await expect(
    repo.record('owner', 'new', 'unknown', false),
  ).rejects.toMatchObject({ status: 404 });
  await expect(repo.record('owner', 'new', 'shoe', true)).rejects.toMatchObject(
    { status: 429 },
  );
  expect(affiliateClick.create).not.toHaveBeenCalled();
  affiliateClick.count.mockResolvedValue(0);
  await expect(repo.record('owner', 'new', 'shoe', true)).resolves.toEqual({
    recorded: true,
  });
  expect(affiliateClick.create).toHaveBeenCalledWith({
    data: { userId: 'owner', id: 'new', productId: 'shoe' },
  });
  expect(affiliateClick.deleteMany).toHaveBeenCalledWith({
    where: { userId: 'owner', createdAt: { lt: expect.any(Date) as Date } },
  });
  lock.mockRejectedValue(new Error('deleted'));
  await expect(repo.record('owner', 'another', 'shoe', true)).rejects.toThrow(
    'deleted',
  );
});
