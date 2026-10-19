import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

const fromCookie = (req: Request) => req?.cookies?.access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      secretOrKey: process.env.JWT_SECRET as string,
      ignoreExpiration: false,
    });
  }
  /** Re-reads the user each request so role changes / deletions take effect immediately. */
  async validate(payload: { sub: string; purpose?: string }) {
    if (payload.purpose) throw new UnauthorizedException(); // socket tokens can't call the REST API
    const u = await this.users.findById(payload.sub);
    if (!u) throw new UnauthorizedException();
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
}
