import 'dotenv/config';
import 'reflect-metadata';
import { createConnection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserSchema } from './users/user.schema';
import { Task, TaskSchema, Status, Priority, Recurrence } from './tasks/task.schema';
import { Notification, NotificationSchema } from './notifications/notification.schema';
import { AuditLog, AuditSchema } from './audit/audit.schema';
import { Role } from './common/roles';

const accounts = [
  { name: 'Demo Admin', email: 'admin@taskflow.test', role: Role.Admin },
  { name: 'Demo Manager', email: 'manager@taskflow.test', role: Role.Manager },
  { name: 'Demo User', email: 'user@taskflow.test', role: Role.User },
];

// Stable IDs make retries safe, even after a partially completed seed.
const seedId = (group: number, index: number) =>
  new Types.ObjectId(`7461736b666c6f77${group.toString(16).padStart(2, '0')}${index.toString(16).padStart(6, '0')}`);

export async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env or the environment before seeding.');
  const password = process.env.SEED_PASSWORD ?? 'TaskFlow123!';
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    throw new Error('SEED_PASSWORD must contain a letter and number, be at least 8 characters, and at most 72 UTF-8 bytes.');

  const connection = createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    await connection.asPromise();
    const users = connection.model(User.name, UserSchema);
    const tasks = connection.model(Task.name, TaskSchema);
    const notifications = connection.model(Notification.name, NotificationSchema);
    const audit = connection.model(AuditLog.name, AuditSchema);
    await Promise.all([users.init(), tasks.init(), notifications.init(), audit.init()]);

    // Refuse collisions rather than changing an existing account's password or privileges.
    for (const account of accounts) {
      const existing = await users.findOne({ email: account.email }).select('+passwordHash');
      if (existing && (existing.role !== account.role || !(await bcrypt.compare(password, existing.passwordHash))))
        throw new Error(`Account ${account.email} already exists with a different role or password; no accounts were changed.`);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const demoUsers = [];
    for (const account of accounts) {
      const user = await users.findOneAndUpdate(
        { email: account.email }, { $setOnInsert: { ...account, passwordHash, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true, new: true, runValidators: true, timestamps: false },
      );
      demoUsers.push(user);
    }

    const now = new Date();
    const day = (offset: number) => new Date(now.getTime() + offset * 86400000);
    const samples: [string, Status, Priority, number, number, number, Recurrence][] = [
      ['Plan the product launch', 'in_progress', 'high', 3, 0, 1, 'none'],
      ['Fix mobile navigation', 'todo', 'high', -2, 1, 2, 'none'],
      ['Review dashboard designs', 'in_progress', 'medium', 2, 2, 1, 'none'],
      ['Write onboarding guide', 'todo', 'medium', 5, 1, 2, 'none'],
      ['Set up project repository', 'done', 'high', -5, 0, 2, 'none'],
      ['Run accessibility checks', 'todo', 'high', 1, 2, 2, 'none'],
      ['Prepare weekly team report', 'todo', 'medium', 4, 0, 1, 'weekly'],
      ['Review daily support queue', 'in_progress', 'low', 1, 1, 2, 'daily'],
      ['Update release notes', 'done', 'low', -3, 2, 1, 'none'],
      ['Resolve customer feedback', 'in_progress', 'high', -1, 1, 2, 'none'],
      ['Review monthly roadmap', 'todo', 'medium', 15, 0, 0, 'monthly'],
      ['Document API endpoints', 'done', 'medium', -1, 1, 2, 'none'],
    ];
    for (const [index, [title, status, priority, due, creator, assignee, recurrence]] of samples.entries()) {
      const taskId = seedId(1, index);
      const createdBy = demoUsers[creator]._id;
      const assignedTo = demoUsers[assignee]._id;
      await tasks.updateOne({ _id: taskId }, { $setOnInsert: {
        title, description: `Demo task: ${title}. Review requirements, coordinate with the team, and record the outcome.`,
        status, priority, dueDate: day(due), createdBy, assignee: assignedTo, recurrence,
        ...(status === 'done' ? { completedAt: day(due) } : {}),
        createdAt: day(-12 + index), updatedAt: day(status === 'done' ? due : -1),
      } }, { upsert: true, runValidators: true, timestamps: false });
      await audit.updateOne({ _id: seedId(2, index) }, { $setOnInsert: {
        actor: createdBy, action: 'task.created', entityType: 'task', entityId: String(taskId),
        meta: { title }, createdAt: day(-12 + index),
      } }, { upsert: true, runValidators: true, timestamps: false });
      if (!createdBy.equals(assignedTo)) {
        await notifications.updateOne({ _id: seedId(3, index) }, { $setOnInsert: {
          user: assignedTo, type: 'assigned', message: `${demoUsers[creator].name} assigned you "${title}"`,
          task: taskId, read: status === 'done', createdAt: day(-12 + index),
        } }, { upsert: true, runValidators: true, timestamps: false });
      }
    }
    console.log('Demo data ready: 3 accounts, 12 tasks, assignment notifications, and audit entries.');
    for (const account of accounts) console.log(`${account.role}: ${account.email}`);
    console.log(process.env.SEED_PASSWORD ? 'Password: your SEED_PASSWORD value.' : 'Password for all demo accounts: TaskFlow123!');
    console.log('Existing records were preserved. Re-running does not reset demo edits or due dates.');
  } finally {
    await connection.close();
  }
}

if (require.main === module) seed().catch((error: unknown) => {
  // Avoid logging connection errors containing database credentials.
  console.error('Demo seed failed:', error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database URI]') : 'Unknown error');
  process.exitCode = 1;
});
