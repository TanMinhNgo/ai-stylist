import { Logger } from '@nestjs/common';
import { AiMeter } from './ai-meter.service';
import { workContext } from './work.service';
import { PrismaService } from '../database/prisma.service';
import { RuntimeConfig } from '../config/runtime-config';
import { JobLimitsService } from './job-limits.service';
it('telemetry failure preserves a paid successful response; deleted users cannot start a call', async () => {
  const logger = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  const info = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const tx = {
    aiCall: { create: jest.fn().mockResolvedValue({ id: 'receipt' }) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (value: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
    ),
    aiCall: {
      updateMany: jest.fn().mockRejectedValue(new Error('private URL')),
    },
  };
  const limits = { lock: jest.fn().mockResolvedValue(undefined) };
  const meter = new AiMeter(
    prisma as unknown as PrismaService,
    { values: { AI_COST_RATES_JSON: {} } } as RuntimeConfig,
    limits as unknown as JobLimitsService,
  );
  const value = { usage: { input_tokens: 10, output_tokens: 20 } },
    call = jest.fn().mockResolvedValue(value);
  try {
    await expect(
      workContext.run({ userId: 'u', jobId: 'j' }, () =>
        meter.request('vision', 'model', call),
      ),
    ).resolves.toBe(value);
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private URL');
    limits.lock.mockRejectedValue(new Error('deleted'));
    await expect(
      workContext.run({ userId: 'u', jobId: 'j' }, () =>
        meter.request('vision', 'model', call),
      ),
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(1);
  } finally {
    logger.mockRestore();
    info.mockRestore();
  }
});
