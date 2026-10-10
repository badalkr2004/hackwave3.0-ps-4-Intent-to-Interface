import { describe, expect, it } from 'vitest';
import { parseMom } from '../src/services/momParse';

describe('parseMom', () => {
  it('extracts title, attendees, decisions, and action items', () => {
    const raw = `
Title: Acme weekly sync
Attendees:
Rohan Mehta, Priya Shah
Decisions:
- Ship export hotfix by Friday
Action items:
- Send status update (Dev Patel) due 2026-10-15
- Book finance onboarding @Priya
Notes:
Finance is still reconciling by hand.
`;
    const p = parseMom(raw);
    expect(p.title).toBe('Acme weekly sync');
    expect(p.attendees).toEqual(expect.arrayContaining(['Rohan Mehta', 'Priya Shah']));
    expect(p.decisions[0]).toMatch(/export hotfix/i);
    expect(p.actionItems.length).toBeGreaterThanOrEqual(2);
    expect(p.actionItems.some((a) => a.owner?.includes('Dev') || a.due)).toBe(true);
    expect(p.summary.length).toBeGreaterThan(10);
  });

  it('falls back when sections are missing', () => {
    const p = parseMom('Quick chat about renewal risk and next steps for the account.');
    expect(p.title).toBeTruthy();
    expect(p.summary).toBeTruthy();
  });
});
