import { describe, it, expect } from 'vitest';
import {
  venueNow,
  toMinutes,
  addDays,
  isSlotExpired,
  isDateFinished,
  selectWindowDates,
  selectHorizonDates,
} from './snozoneWindow.js';

/**
 * The container runs on UTC while slot times are venue-local, so these tests
 * pin the BST behaviour explicitly. Every instant below is constructed in UTC
 * and asserted in Europe/London terms.
 */

const horizon31 = Array.from({ length: 31 }, (_, i) => addDays('2026-08-25', i));

describe('venueNow', () => {
  it('applies BST in summer', () => {
    // 22:30 UTC on 25 Aug is 23:30 BST — still the 25th locally.
    expect(venueNow(new Date('2026-08-25T22:30:00Z'))).toEqual({
      date: '2026-08-25', minutes: 23 * 60 + 30,
    });
  });

  it('rolls the local date over before UTC midnight in summer', () => {
    // 23:30 UTC is already 00:30 on the 26th in London. Bucketing this by UTC
    // would file an overnight booking under the wrong day.
    expect(venueNow(new Date('2026-08-25T23:30:00Z'))).toEqual({
      date: '2026-08-26', minutes: 30,
    });
  });

  it('uses GMT in winter', () => {
    expect(venueNow(new Date('2026-12-15T22:30:00Z'))).toEqual({
      date: '2026-12-15', minutes: 22 * 60 + 30,
    });
  });

  it('normalises midnight to minute 0, not 1440', () => {
    expect(venueNow(new Date('2026-12-15T00:00:00Z')).minutes).toBe(0);
  });
});

describe('toMinutes', () => {
  it('parses valid times', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('10:05')).toBe(605);
    expect(toMinutes('20:00')).toBe(1200);
  });

  it('rejects malformed or out-of-range values', () => {
    for (const bad of ['', '9:00', '24:00', '10:60', 'abc', '10:0a']) {
      expect(toMinutes(bad), bad).toBeNull();
    }
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-25', 3)).toBe('2026-08-28');
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('does not drift across the DST change', () => {
    // 25 Oct 2026 is the BST->GMT switch; a naive local-time addition can land
    // on the same day twice.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('isSlotExpired', () => {
  const now = { date: '2026-08-25', minutes: 12 * 60 }; // 12:00 local

  it('is true for earlier slots today and any past date', () => {
    expect(isSlotExpired(now, '2026-08-25', '10:00')).toBe(true);
    expect(isSlotExpired(now, '2026-08-24', '19:00')).toBe(true);
  });

  it('is false for later slots today and any future date', () => {
    expect(isSlotExpired(now, '2026-08-25', '12:30')).toBe(false);
    expect(isSlotExpired(now, '2026-08-26', '10:00')).toBe(false);
  });

  it('treats the exact start minute as not yet expired', () => {
    expect(isSlotExpired(now, '2026-08-25', '12:00')).toBe(false);
  });
});

describe('isDateFinished', () => {
  it('is false when we have never observed the date', () => {
    // We cannot conclude a date is finished from data we do not have.
    const late = { date: '2026-08-25', minutes: 23 * 60 };
    expect(isDateFinished(late, '2026-08-25', null)).toBe(false);
  });

  it('is true once the last slot has started', () => {
    const late = { date: '2026-08-25', minutes: 22 * 60 };
    expect(isDateFinished(late, '2026-08-25', '20:00')).toBe(true);
  });

  it('is false while slots remain', () => {
    const midday = { date: '2026-08-25', minutes: 12 * 60 };
    expect(isDateFinished(midday, '2026-08-25', '20:00')).toBe(false);
  });
});

describe('selectWindowDates', () => {
  const lastSlots = { '2026-08-25': '20:00' };

  it('takes today, +1 and +2', () => {
    const now = { date: '2026-08-25', minutes: 12 * 60 };
    expect(selectWindowDates(horizon31, now, lastSlots)).toEqual({
      dates: ['2026-08-25', '2026-08-26', '2026-08-27'],
      skipped: [],
    });
  });

  it('drops a finished today late in the evening', () => {
    const now = { date: '2026-08-25', minutes: 22 * 60 + 30 };
    expect(selectWindowDates(horizon31, now, lastSlots)).toEqual({
      dates: ['2026-08-26', '2026-08-27'],
      skipped: ['2026-08-25'],
    });
  });

  it('keeps today overnight, when it is a fresh date again', () => {
    // 00:30 on the 26th: every slot on the 26th is still ahead, so the
    // evening skip must NOT carry over past midnight.
    const now = { date: '2026-08-26', minutes: 30 };
    const sel = selectWindowDates(horizon31, now, { '2026-08-26': '20:00' });
    expect(sel.dates).toEqual(['2026-08-26', '2026-08-27', '2026-08-28']);
    expect(sel.skipped).toEqual([]);
  });

  it('ignores dates Snozone does not advertise as bookable', () => {
    const now = { date: '2026-08-25', minutes: 12 * 60 };
    const gappy = ['2026-08-25', '2026-08-27'];
    expect(selectWindowDates(gappy, now, lastSlots).dates)
      .toEqual(['2026-08-25', '2026-08-27']);
  });
});

describe('selectHorizonDates', () => {
  const now = { date: '2026-08-25', minutes: 4 * 60 + 5 };

  it('starts where the high-resolution window ends, so nothing is fetched twice', () => {
    const dates = selectHorizonDates(horizon31, now);
    expect(dates[0]).toBe('2026-08-28');
    expect(dates).toHaveLength(28);
    const windowDates = selectWindowDates(horizon31, now, {}).dates;
    expect(dates.filter((d) => windowDates.includes(d))).toEqual([]);
  });

  it('is empty when the horizon does not reach past the window', () => {
    expect(selectHorizonDates(['2026-08-25', '2026-08-26'], now)).toEqual([]);
  });
});
