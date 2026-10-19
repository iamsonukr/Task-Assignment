import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditDocument, AuditLog } from './audit.schema';

@Injectable()
export class AuditService {
  private logger = new Logger('Audit');
  constructor(@InjectModel(AuditLog.name) private model: Model<AuditDocument>) {}

  /** Never throws: a failed audit write must not break the user's action. */
  async log(actor: string | undefined, action: string, entityType?: string, entityId?: string, meta?: Record<string, unknown>) {
    try { await this.model.create({ actor, action, entityType, entityId, meta }); }
    catch (e) { this.logger.error(`audit write failed: ${(e as Error).message}`); }
  }

  async list(page = 1, limit = 50, action?: string) {
    const filter = action ? { action } : {};
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name email').lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }
}
