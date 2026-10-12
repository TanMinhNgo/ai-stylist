import { Injectable } from '@nestjs/common';
import { TryOnProvider } from './try-on.provider';

@Injectable()
export class FakeTryOnProvider extends TryOnProvider {
  readonly name = 'fake' as const;
  readonly model = 'fake';
  generate(): Promise<Buffer> {
    // A fixed PNG is an explicit mock result, never a simulated clothing edit.
    return Promise.resolve(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    );
  }
}
