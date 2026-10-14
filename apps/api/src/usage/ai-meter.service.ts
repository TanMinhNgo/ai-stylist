import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';
import { RuntimeConfig } from '../config/runtime-config';
import { JobLimitsService } from './job-limits.service';
import { workContext } from './work.service';
const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
});
export function metered<T>(
  meter: AiMeter | undefined,
  kind: string,
  model: string,
  operation: () => Promise<T>,
) {
  return meter ? meter.request(kind, model, operation) : operation();
}
export function measuredUsage(
  response: unknown,
  rate?: { input: number; output: number },
) {
  const parsed = z.object({ usage: usageSchema }).safeParse(response);
  const inputTokens = parsed.success
    ? (parsed.data.usage.input_tokens ??
      parsed.data.usage.prompt_tokens ??
      null)
    : null;
  const outputTokens = parsed.success
    ? (parsed.data.usage.output_tokens ??
      (parsed.data.usage.prompt_tokens !== undefined ? 0 : null))
    : null;
  return {
    inputTokens,
    outputTokens,
    estimatedUsd:
      rate && inputTokens !== null && outputTokens !== null
        ? (inputTokens * rate.input + outputTokens * rate.output) / 1e6
        : null,
  };
}
@Injectable()
export class AiMeter {
  private readonly logger = new Logger(AiMeter.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: RuntimeConfig,
    private readonly limits: JobLimitsService,
  ) {}
  async request<T>(
    kind: string,
    model: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const context = workContext.getStore();
    if (!context) return operation();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.limits.lock(tx, context.userId);
      return tx.aiCall.create({ data: { ...context, kind, model } });
    });
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      await this.prisma.aiCall
        .updateMany({
          where: { id: row.id },
          data: { status: 'failed_unknown_cost' },
        })
        .catch(() => this.logger.error('AI cost receipt needs recovery'));
      throw error;
    }
    const measured = measuredUsage(
      result,
      this.config.values.AI_COST_RATES_JSON[model],
    );
    // Telemetry failure must not discard a successful paid response and trigger another AI call.
    await this.prisma.aiCall
      .updateMany({
        where: { id: row.id },
        data: { status: 'succeeded', ...measured },
      })
      .catch(() => this.logger.error('AI cost receipt needs recovery'));
    this.logger.log({
      event: 'ai_usage',
      ...context,
      kind,
      model,
      ...measured,
    });
    return result;
  }
}
