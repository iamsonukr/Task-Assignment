import { createConnection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { seed } from './seed';

jest.mock('mongoose', () => ({ ...jest.requireActual('mongoose'), createConnection: jest.fn() }));

describe('demo seed', () => {
  const originalUri = process.env.MONGODB_URI;
  const originalPassword = process.env.SEED_PASSWORD;
  let connection: any;
  let records: Record<string, Map<string, any>>;

  beforeEach(() => {
    process.env.MONGODB_URI = 'mongodb://unused/test';
    process.env.SEED_PASSWORD = 'TestSeed123!';
    records = {};
    connection = {
      asPromise: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      model: jest.fn((name: string) => {
        const store = records[name] ??= new Map();
        return {
          init: jest.fn().mockResolvedValue(undefined),
          findOne: ({ email }: any) => ({ select: async () => store.get(email) }),
          findOneAndUpdate: async ({ email }: any, update: any) => {
            if (!store.has(email)) store.set(email, { _id: new Types.ObjectId(), ...update.$setOnInsert });
            return store.get(email);
          },
          updateOne: async ({ _id }: any, update: any) => {
            if (!store.has(String(_id))) store.set(String(_id), { _id, ...update.$setOnInsert });
          },
        };
      }),
    };
    (createConnection as jest.Mock).mockReturnValue(connection);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
    if (originalPassword === undefined) delete process.env.SEED_PASSWORD;
    else process.env.SEED_PASSWORD = originalPassword;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates usable hashed logins and preserves task edits on a retry', async () => {
    await seed();
    expect(records.User.size).toBe(3);
    expect(records.Task.size).toBe(12);
    expect(records.AuditLog.size).toBe(12);
    expect(records.Notification.size).toBeGreaterThan(0);
    for (const user of records.User.values()) {
      expect(await bcrypt.compare('TestSeed123!', user.passwordHash)).toBe(true);
    }
    const task = [...records.Task.values()][0];
    task.title = 'Edited by a real user';
    task.status = 'done';
    const snapshot = JSON.stringify(Object.fromEntries(Object.entries(records).map(([name, store]) => [name, [...store.values()]])));
    await seed();
    expect(JSON.stringify(Object.fromEntries(Object.entries(records).map(([name, store]) => [name, [...store.values()]])))).toBe(snapshot);
    expect(connection.close).toHaveBeenCalledTimes(2);
  });

  it('refuses a conflicting account before changing any data and closes the connection', async () => {
    records.User = new Map([['admin@taskflow.test', { role: 'user', passwordHash: 'existing' }]]);
    await expect(seed()).rejects.toThrow('already exists');
    expect(records.User.size).toBe(1);
    expect(records.Task.size).toBe(0);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing database URI before connecting', async () => {
    delete process.env.MONGODB_URI;
    await expect(seed()).rejects.toThrow('Set MONGODB_URI');
    expect(createConnection).not.toHaveBeenCalled();
  });
});
