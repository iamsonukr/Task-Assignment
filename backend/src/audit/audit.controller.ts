import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/decorators';
import { Role } from '../common/roles';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() @Roles(Role.Admin, Role.Manager)
  list(@Query('page') page?: string, @Query('action') action?: string) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    return this.audit.list(p, 50, typeof action === 'string' ? action : undefined);
  }
}
