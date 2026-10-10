import { describe, expect, it } from 'vitest';
import { HELIOS_CLIENT_IDS } from '../src/db/story-helios';
import { HELIOS, NORTHWIND } from '../src/db/tenants';

describe('demo tenants', () => {
  it('assign disjoint client portfolios', () => {
    const a = new Set(NORTHWIND.clientIds);
    const b = new Set(HELIOS.clientIds);
    for (const id of a) expect(b.has(id)).toBe(false);
    expect([...a]).toEqual(expect.arrayContaining(['acme', 'globex']));
    expect([...b]).toEqual(expect.arrayContaining([...HELIOS_CLIENT_IDS]));
  });
});
