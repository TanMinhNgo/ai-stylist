import { BadRequestException } from '@nestjs/common';
import { HealthResponse } from '@stylist/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(HealthResponse);

  it('returns parsed data', () => {
    expect(pipe.transform({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it.each([null, {}, { status: 'ok', secret: 'private' }])(
    'rejects invalid or extra fields: %p',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    },
  );
});
