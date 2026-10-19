import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { Role } from '../common/roles';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private model: Model<UserDocument>) {}

  findByEmailWithPassword(email: string) { return this.model.findOne({ email: email.toLowerCase() }).select('+passwordHash'); }
  findById(id: string) { return this.model.findById(id); }
  /** Atomically decides the role: the very first account becomes admin. */
  async create(data: { name: string; email: string; passwordHash: string }) {
    const first = (await this.model.estimatedDocumentCount()) === 0;
    return this.model.create({ ...data, role: first ? Role.Admin : Role.User });
  }
  /** Lightweight directory used by the "assign to" picker. */
  list() { return this.model.find().select('name email role').sort({ name: 1 }).lean(); }

  async setRole(id: string, role: Role) {
    const u = await this.model.findByIdAndUpdate(id, { role }, { new: true });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }
  async updatePrefs(id: string, prefs: Partial<User['notificationPrefs']>) {
    const set: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(prefs)) if (typeof v === 'boolean') set[`notificationPrefs.${k}`] = v;
    const u = await this.model.findByIdAndUpdate(id, { $set: set }, { new: true });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }
}
