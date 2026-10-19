import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditSchema } from './audit.schema';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditSchema }])],
  providers: [AuditService], controllers: [AuditController], exports: [AuditService],
})
export class AuditModule {}
