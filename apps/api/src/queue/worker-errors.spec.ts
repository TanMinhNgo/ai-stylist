import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { AnalysisProcessor } from '../media/analysis.processor';
import { TryOnProcessor } from '../try-on/try-on.processor';
import { AssetProcessor } from '../garment-assets/asset.processor';
import { StylistProcessor } from '../stylist/stylist.processor';

it.each([AnalysisProcessor, TryOnProcessor, AssetProcessor, StylistProcessor])(
  '%s registers a safe BullMQ error listener',
  (Processor) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Nest stores event metadata on the method itself.
    const handler = Processor.prototype.onWorkerError;
    expect(
      Reflect.getMetadata('bullmq:worker_events_metadata', handler),
    ).toEqual({ eventName: 'error' });
    const instanceLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const staticLog = jest.spyOn(Logger, 'error').mockImplementation(() => {});
    const worker = new EventEmitter();
    worker.on('error', () => {
      handler.call({ logger: new Logger('test') });
    });
    expect(() =>
      worker.emit('error', new Error('private credentials and URL')),
    ).not.toThrow();
    expect(
      JSON.stringify([...instanceLog.mock.calls, ...staticLog.mock.calls]),
    ).not.toContain('private');
    jest.restoreAllMocks();
  },
);
