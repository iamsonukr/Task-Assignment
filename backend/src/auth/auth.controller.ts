import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/decorators';
import { UsersService } from '../users/users.service';

const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SEVEN_DAYS,
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Post('register') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto);
    res.cookie('access_token', token, cookieOpts());
    return user;
  }

  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    res.cookie('access_token', token, cookieOpts());
    return user;
  }

  @Post('logout') @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { ...cookieOpts(), maxAge: undefined });
    return { ok: true };
  }

  @Get('me') @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() me: AuthUser) {
    return this.auth.sanitize(await this.users.findById(me.id));
  }

  @Get('socket-token') @UseGuards(JwtAuthGuard)
  socketToken(@CurrentUser() me: AuthUser) { return { token: this.auth.socketToken(me.id) }; }
}
