import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/decorators';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}
  @Get() summary(@CurrentUser() u: AuthUser) { return this.svc.summary(u); }
}
