import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HealthResponse } from '@gestalt/shared';
import { createApp } from '../src/app';

let baseUrl = '';
let close: () => void = () => {};

beforeAll(async () => {
  const server = createApp().listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

describe('GET /api/health', () => {
  it('returns a body matching the shared HealthResponse contract', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(await res.json()).success).toBe(true);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
