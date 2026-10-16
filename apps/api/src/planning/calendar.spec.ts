import { addDays, localDate, checkDateWindow } from './calendar';
describe('local calendar semantics', () => {
  afterEach(() => jest.useRealTimers());
  it('keeps seven calendar dates across DST, leap days and years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-07', 6)).toBe('2026-03-13');
  });
  it('interprets today in the submitted zone, not server UTC', () => {
    const now = new Date('2026-10-17T00:30:00Z');
    expect(localDate('America/Los_Angeles', now)).toBe('2026-10-16');
    expect(localDate('Asia/Ho_Chi_Minh', now)).toBe('2026-10-17');
  });
  it('rejects future wear and past planner writes while allowing current local dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T00:30:00Z'));
    expect(() =>
      checkDateWindow('2026-10-17', 'America/Los_Angeles', 'wear'),
    ).toThrow();
    expect(() =>
      checkDateWindow('2026-10-16', 'America/Los_Angeles', 'wear'),
    ).not.toThrow();
    expect(() => checkDateWindow('2026-10-16', 'UTC', 'planner')).toThrow();
    expect(() => checkDateWindow('2026-10-17', 'UTC', 'planner')).not.toThrow();
    expect(() => checkDateWindow('2024-10-17', 'UTC', 'wear')).toThrow();
    expect(() => checkDateWindow('2028-10-17', 'UTC', 'planner')).toThrow();
  });
});
