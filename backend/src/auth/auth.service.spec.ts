import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const mk = (users: any) => new AuthService(users, { sign: jest.fn(() => 'jwt') } as any, { log: jest.fn() } as any);

describe('AuthService', () => {
  it('stores a bcrypt hash, never the plaintext password', async () => {
    const create = jest.fn(async (d) => ({ id: 'u1', ...d }));
    await mk({ create }).register({ name: 'Sonu', email: 'S@X.io', password: 'Passw0rdPass' });
    const arg = create.mock.calls[0][0];
    expect(arg.email).toBe('s@x.io');
    expect(arg.passwordHash).not.toContain('Passw0rd');
    expect(await bcrypt.compare('Passw0rdPass', arg.passwordHash)).toBe(true);
  });

  it('maps duplicate-key errors to 409', async () => {
    const svc = mk({ create: jest.fn().mockRejectedValue({ code: 11000 }) });
    await expect(svc.register({ name: 'A', email: 'a@b.co', password: 'Passw0rd1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const hash = await bcrypt.hash('Right1234', 4);
    const svc = mk({ findByEmailWithPassword: jest.fn(async (e: string) => (e === 'known@x.io' ? { id: '1', passwordHash: hash } : null)) });
    const a = await svc.login({ email: 'nobody@x.io', password: 'Right1234' }).catch((e) => e);
    const b = await svc.login({ email: 'known@x.io', password: 'Wrong1234' }).catch((e) => e);
    expect(a).toBeInstanceOf(UnauthorizedException);
    expect(b).toBeInstanceOf(UnauthorizedException);
    expect(a.message).toBe(b.message);
    await expect(svc.login({ email: 'known@x.io', password: 'Right1234' })).resolves.toHaveProperty('token', 'jwt');
  });
});
