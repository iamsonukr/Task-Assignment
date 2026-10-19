import { AnalyticsService } from './analytics.service';
import { Role } from '../common/roles';

describe('AnalyticsService', () => {
  it('keeps personal visibility and date filters together and counts unassigned overdue tasks', async () => {
    const model: any = {
      aggregate: jest.fn().mockResolvedValue([]),
      find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })),
      countDocuments: jest.fn().mockResolvedValue(2),
    };
    const user = { id: '507f1f77bcf86cd799439011', name: 'User', email: 'a@example.com', role: Role.User };
    const result = await new AnalyticsService(model).summary(user);
    const filter = model.find.mock.calls[0][0];
    expect(filter.$and[0].$or).toEqual([{ createdBy: expect.anything() }, { assignee: expect.anything() }]);
    expect(String(filter.$and[0].$or[0].createdBy)).toBe(user.id);
    expect(filter.$and[1].$or).toHaveLength(3);
    expect(model.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      $or: filter.$and[0].$or,
      dueDate: { $type: 'date', $lt: expect.any(Date) }, status: { $ne: 'done' },
    }));
    expect(result.totals.overdue).toBe(2);
  });
});
