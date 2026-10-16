import { Injectable } from '@nestjs/common';
import type {
  PutPlannerDayRequest,
  WardrobePeriodQuery,
} from '@stylist/shared';
import { UsageService } from '../usage/usage.service';
import { PlanningRepository } from './planning.repository';
import { InsightsRepository } from './insights.repository';
@Injectable()
export class PlanningService {
  constructor(
    private readonly repo: PlanningRepository,
    private readonly insights: InsightsRepository,
    private readonly usage: UsageService,
  ) {}
  async putDay(userId: string, date: string, body: PutPlannerDayRequest) {
    await this.usage.requireFeature(userId, 'weekly_outfit_planner');
    return this.repo.putDay(userId, date, body);
  }
  async getInsights(userId: string, query: WardrobePeriodQuery) {
    await this.usage.requireFeature(userId, 'wardrobe_insights');
    return this.insights.get(userId, query);
  }
}
