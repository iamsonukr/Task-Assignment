import { createParamDecorator, ExecutionContext, SetMetadata, CanActivate, Injectable, ForbiddenException, PipeTransform, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isValidObjectId } from 'mongoose';
import { Role } from './roles';

export interface AuthUser { id: string; email: string; name: string; role: Role }

export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.get<Role[]>('roles', ctx.getHandler());
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

/** Rejects malformed ids early (also blocks NoSQL-operator objects in path params). */
@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== 'string' || !isValidObjectId(value)) throw new BadRequestException('Invalid id');
    return value;
  }
}
