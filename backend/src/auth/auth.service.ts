import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_COST = 12;
// Pre-computed hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService, private audit: AuditService) {}

  sanitize(u: any) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, notificationPrefs: u.notificationPrefs };
  }
  sign(userId: string) { return this.jwt.sign({ sub: userId }); }
  /** Short-lived token the browser uses only for the Socket.io handshake. */
  socketToken(userId: string) { return this.jwt.sign({ sub: userId, purpose: 'socket' }, { expiresIn: '5m' }); }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    try {
      const u = await this.users.create({ name: dto.name, email: dto.email.toLowerCase(), passwordHash });
      await this.audit.log(u.id, 'auth.registered', 'user', u.id);
      return { user: this.sanitize(u), token: this.sign(u.id) };
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email already registered'); // unique index handles races
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const u = await this.users.findByEmailWithPassword(dto.email);
    const ok = await bcrypt.compare(dto.password, u?.passwordHash ?? DUMMY_HASH);
    if (!u || !ok) throw new UnauthorizedException('Invalid email or password');
    await this.audit.log(u.id, 'auth.login', 'user', u.id);
    return { user: this.sanitize(u), token: this.sign(u.id) };
  }
}
