import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { isValidObjectId } from 'mongoose';

const origins = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim());

@WebSocketGateway({ cors: { origin: origins, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(private jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const p = this.jwt.verify(String(client.handshake.auth?.token));
      if (p.purpose !== 'socket' || typeof p.sub !== 'string' || !isValidObjectId(p.sub)) {
        client.disconnect(true);
        return;
      }
      client.join(`user:${p.sub}`); // each user only ever joins their own room
    } catch { client.disconnect(true); }
  }
  emitToUser(userId: string, event: string, payload: unknown) { this.server?.to(`user:${userId}`).emit(event, payload); }
}
