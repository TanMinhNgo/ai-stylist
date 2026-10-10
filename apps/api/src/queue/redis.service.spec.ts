import { RedisService } from './redis.service';
import { RuntimeConfig } from '../config/runtime-config';

const client = {
  on: jest.fn(),
  connect: jest.fn(),
  ping: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => client),
}));

describe('Redis readiness and lifecycle', () => {
  const config = {
    values: { REDIS_URL: 'redis://localhost:6379' },
  } as RuntimeConfig;
  beforeEach(() => {
    jest.clearAllMocks();
    client.connect.mockResolvedValue(undefined);
    client.ping.mockResolvedValue('PONG');
  });
  afterEach(() => jest.useRealTimers());

  it('connects and pings before startup, then disconnects on shutdown', async () => {
    const service = new RedisService(config);
    await service.onModuleInit();
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.ping).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('fails startup if the socket cannot connect', async () => {
    client.connect.mockRejectedValue(new Error('unreachable'));
    await expect(new RedisService(config).onModuleInit()).rejects.toThrow(
      'unreachable',
    );
    expect(client.ping).not.toHaveBeenCalled();
  });

  it('times out if a connected Redis does not answer PING', async () => {
    jest.useFakeTimers();
    client.ping.mockReturnValue(new Promise(() => {}));
    const startup = new RedisService(config).onModuleInit();
    const check = expect(startup).rejects.toThrow('Redis readiness timeout');
    await jest.advanceTimersByTimeAsync(5000);
    await check;
    expect(jest.getTimerCount()).toBe(0);
  });
});
