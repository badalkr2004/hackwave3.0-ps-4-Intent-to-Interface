import { HealthResponse } from '@gestalt/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return HealthResponse.parse(await res.json());
}
