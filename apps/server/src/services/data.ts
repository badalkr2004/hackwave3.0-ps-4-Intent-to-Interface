import {
  PANEL_PROPS,
  isComponentId,
  type ComponentId,
  type PanelProps,
  type Scope,
  type Shape,
} from '@gestalt/shared';
import type { Db } from '../db/client';
import { toISODate } from '../lib/dates';
import { log } from '../log';
import { REGISTRY } from '../registry';
import type { LoadContext, RegistryModule } from '../registry/types';
import type { ComponentData } from './auction';

const CACHE_TTL_MS = 60_000;

/** Every module's props for one scope, loaded once and shared by all shapes. */
export interface ScopeData {
  ctx: LoadContext;
  props: { [K in ComponentId]?: PanelProps<K> | null };
}

const cache = new Map<string, { at: number; data: Promise<ScopeData> }>();

export function clearDataCache(): void {
  cache.clear();
}

function createContext(
  db: Db,
  scope: Scope,
  today: Date,
  allowedClientIds: readonly string[] | null,
): LoadContext {
  const memo = new Map<string, Promise<unknown>>();
  const ctx: LoadContext = {
    db,
    scope,
    today,
    allowedClientIds,
    once<T>(key: string, fn: () => Promise<T>): Promise<T> {
      let p = memo.get(key) as Promise<T> | undefined;
      if (!p) {
        p = fn();
        memo.set(key, p);
      }
      return p;
    },
    load<K extends ComponentId>(id: K): Promise<PanelProps<K> | null> {
      return ctx.once(`module:${id}`, () => runLoader(REGISTRY[id] as RegistryModule<K>, ctx));
    },
  };
  return ctx;
}

async function runLoader<K extends ComponentId>(
  mod: RegistryModule<K>,
  ctx: LoadContext,
): Promise<PanelProps<K> | null> {
  try {
    const props = await mod.loader(ctx);
    if (props === null) return null;
    const parsed = PANEL_PROPS[mod.id].safeParse(props);
    if (!parsed.success) {
      log.warn(`loader ${mod.id} returned invalid props`, {
        issues: parsed.error.issues.slice(0, 3),
      });
      return null;
    }
    return parsed.data as PanelProps<K>;
  } catch (err) {
    log.warn(`loader ${mod.id} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Runs all loaders in parallel for a scope. Results are cached for 60 s per scope and day. */
export function loadScopeData(
  db: Db,
  scope: Scope,
  today: Date,
  allowedClientIds: readonly string[] | null = null,
): Promise<ScopeData> {
  const key = JSON.stringify([
    db.schema,
    scope.clientId,
    scope.projectId,
    scope.timeRange,
    toISODate(today),
    allowedClientIds ? [...allowedClientIds].sort() : null,
  ]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = (async () => {
    const ctx = createContext(db, scope, today, allowedClientIds);
    const ids = Object.keys(REGISTRY).filter(isComponentId);
    const loaded = await Promise.all(ids.map(async (id) => [id, await ctx.load(id)] as const));
    return { ctx, props: Object.fromEntries(loaded) as ScopeData['props'] };
  })();
  cache.set(key, { at: Date.now(), data });
  data.catch(() => cache.delete(key));
  return data;
}

async function scoreModule<K extends ComponentId>(
  mod: RegistryModule<K>,
  raw: PanelProps<K> | null | undefined,
  shape: Shape,
  ctx: LoadContext,
): Promise<ComponentData> {
  if (raw === null || raw === undefined) return { props: null, signal: 0, evidence: [] };
  const props = mod.forShape ? mod.forShape(raw, shape) : raw;
  try {
    const signal = await mod.signal(props, ctx);
    return { props, signal, evidence: mod.evidence(props).slice(0, 3) };
  } catch (err) {
    log.warn(`signal/evidence for ${mod.id} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return { props, signal: 0, evidence: [] };
  }
}

/** Shape-specific auction input: props after forShape, plus signal and evidence for each module. */
export async function componentData(
  data: ScopeData,
  shape: Shape,
): Promise<Record<string, ComponentData>> {
  const ids = Object.keys(REGISTRY).filter(isComponentId);
  const entries = await Promise.all(
    ids.map(
      async (id) =>
        [
          id,
          await scoreModule(REGISTRY[id] as RegistryModule, data.props[id], shape, data.ctx),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}
