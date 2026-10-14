import { JobLimitsService } from '../usage/job-limits.service';
import { AssetRepository } from './asset.repository';
import { PrismaService } from '../database/prisma.service';
import { MediaRepository } from '../media/media.repository';

it('does not restore the proposal limit after a started LLM job fails', async () => {
  const count = jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(10);
  const repository = new AssetRepository(
    { assetJob: { count } } as unknown as PrismaService,
    {} as MediaRepository,
    {} as JobLimitsService,
  );
  const quota = await repository.usage('user');
  expect(quota.remaining).toBe(3);
  expect(quota.ideaPlansRemaining).toBe(0);
  expect(count).toHaveBeenLastCalledWith({
    where: {
      userId: 'user',
      quotaDay: expect.any(String) as string,
      kind: 'plan',
      OR: [{ refundedAt: null }, { generationStartedAt: { not: null } }],
    },
  });
});
