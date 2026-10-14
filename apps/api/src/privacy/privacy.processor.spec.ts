import { randomUUID } from 'node:crypto';
import { Job } from 'bullmq';
import { PrivacyProcessor } from './privacy.processor';
import { PrivacyService } from './privacy.service';
it('recovery enqueues only deletion receipts and never stores private provider errors', async () => {
  const row = { id: randomUUID(), userId: randomUUID() };
  const privacy = {
    due: jest.fn().mockResolvedValue([row]),
    enqueue: jest.fn().mockResolvedValue({}),
    purge: jest.fn().mockRejectedValue(new Error('private signed URL')),
  };
  const processor = new PrivacyProcessor(privacy as unknown as PrivacyService);
  await processor.sweep();
  expect(privacy.enqueue).toHaveBeenCalledWith(row.id, row.userId);
  await expect(processor.process({ data: row } as Job)).rejects.toThrow(
    'Account deletion deferred',
  );
  await expect(
    processor.process({ data: { ...row, url: 'secret' } } as Job),
  ).rejects.toThrow('Invalid deletion job');
  expect(privacy.purge).toHaveBeenCalledTimes(1);
});
