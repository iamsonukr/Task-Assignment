import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UsersService } from './users.service';
import { AuthUser, CurrentUser, JwtAuthGuard, ObjectIdPipe, Roles, RolesGuard } from '../common/decorators';
import { Role } from '../common/roles';
import { AuditService } from '../audit/audit.service';

class RoleDto { @IsEnum(Role) role: Role; }
class PrefsDto {
  @IsOptional() @IsBoolean() inApp?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() muteAssigned?: boolean;
  @IsOptional() @IsBoolean() muteUpdated?: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService, private audit: AuditService) {}

  @Get() list() { return this.users.list(); }

  @Patch('me/preferences')
  async prefs(@CurrentUser() me: AuthUser, @Body() dto: PrefsDto) {
    const u = await this.users.updatePrefs(me.id, dto);
    await this.audit.log(me.id, 'user.preferences_updated', 'user', me.id, { ...dto });
    return u.notificationPrefs;
  }

  @Patch(':id/role') @Roles(Role.Admin)
  async setRole(@CurrentUser() me: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body() dto: RoleDto) {
    // Prevent the last admin from locking everyone out by demoting themselves.
    if (id === me.id && dto.role !== Role.Admin) throw new BadRequestException('Admins cannot demote themselves');
    const u = await this.users.setRole(id, dto.role);
    await this.audit.log(me.id, 'user.role_changed', 'user', id, { role: dto.role });
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  }
}
