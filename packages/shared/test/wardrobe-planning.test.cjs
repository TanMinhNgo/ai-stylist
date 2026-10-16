const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CalendarDate, CalendarTimeZone, PlannerWeekQuery, PutPlannerDayRequest, PutWearRecordRequest, WardrobePeriodQuery, PlannerWeekResponse } = require('../dist');
test('calendar contracts validate real dates, IANA zones and bounded 7-day/year windows', () => {
  assert.ok(CalendarDate.safeParse('2028-02-29').success);
  for (const date of ['2026-02-29', '2026-13-01', '1899-12-31']) assert.equal(CalendarDate.safeParse(date).success, false);
  assert.equal(CalendarTimeZone.safeParse('Mars/Olympus').success, false);
  assert.equal(CalendarTimeZone.safeParse('+07:00').success, false);
  assert.ok(PlannerWeekQuery.safeParse({ startDate: '2026-12-29', timeZone: 'America/New_York' }).success);
  assert.equal(PlannerWeekQuery.safeParse({ startDate: '2099-12-31', timeZone: 'UTC' }).success, false);
  assert.ok(WardrobePeriodQuery.safeParse({ from: '2026-01-01', to: '2027-01-01' }).success);
  for (const value of [{ from: '2026-01-01', to: '2027-01-02' }, { from: '2026-02-01', to: '2026-01-01' }]) assert.equal(WardrobePeriodQuery.safeParse(value).success, false);
});
test('manual planner and explicit wear require owner-safe input and do not accept plan/AI flags', () => {
  const plan = { timeZone: 'UTC', occasion: ' Đi làm ', outfitId: null };
  assert.equal(PutPlannerDayRequest.parse(plan).occasion, 'Đi làm');
  assert.equal(PutPlannerDayRequest.safeParse({ ...plan, generate: true }).success, false);
  assert.equal(PutPlannerDayRequest.safeParse({ ...plan, userId: randomUUID() }).success, false);
  assert.equal(PutWearRecordRequest.safeParse({ timeZone: 'UTC', date: '2026-10-17', outfitId: randomUUID() }).success, true);
  assert.equal(PutWearRecordRequest.safeParse({ timeZone: 'UTC', date: '2026-10-17', outfitId: null }).success, false);
  assert.equal(PlannerWeekResponse.safeParse({ startDate: '2026-10-17', timeZone: 'UTC', days: [] }).success, false);
});
