import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway authentication', () => {
  const userId = '507f1f77bcf86cd799439011';
  it.each([
    { sub: userId },
    { sub: 'invalid', purpose: 'socket' },
    { purpose: 'socket' },
  ])('rejects claims that are not a valid socket identity: %j', (payload) => {
    const gateway = new NotificationsGateway({ verify: () => payload } as any);
    const client = { handshake: { auth: { token: 'token' } }, join: jest.fn(), disconnect: jest.fn() };
    gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });
  it('joins only the authenticated user room', () => {
    const gateway = new NotificationsGateway({ verify: () => ({ sub: userId, purpose: 'socket' }) } as any);
    const client = { handshake: { auth: { token: 'token' } }, join: jest.fn(), disconnect: jest.fn() };
    gateway.handleConnection(client as any);
    expect(client.join).toHaveBeenCalledWith(`user:${userId}`);
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
