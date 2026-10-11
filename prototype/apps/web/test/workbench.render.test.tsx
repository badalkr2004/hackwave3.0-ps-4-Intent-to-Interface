import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { UISpec } from '@gestalt/shared';
import { Workbench } from '../src/workbench/Workbench';
import { TaskHeader } from '../src/workbench/TaskHeader';
import { OverviewCanvas } from '../src/workbench/OverviewCanvas';
import { extractWorkbench } from '../src/workbench/extract';

const overviewSpec = {
  id: 'spec-1',
  version: 1,
  degraded: false,
  intent: {
    shape: 'overview',
    scope: { clientId: null, projectId: null, timeRange: '30d' },
    confidence: 1,
    summary: 'Portfolio overview',
    headline: 'Your portfolio',
  },
  needs: [],
  panels: [
    {
      id: 'p1',
      componentId: 'portfolio_health',
      need: 'portfolio_health',
      zone: 'center',
      order: 0,
      size: 'L',
      pinned: false,
      status: 'ready',
      props: {
        clients: [
          {
            id: 'c1',
            name: 'Acme',
            plan: 'Enterprise',
            arr: 120000,
            health: 72,
            usageChangePct: -18,
            renewalInDays: 40,
          },
        ],
        totalArr: 120000,
        atRiskCount: 1,
      },
    },
    {
      id: 'p2',
      componentId: 'upcoming_meetings',
      need: 'schedule',
      zone: 'left',
      order: 0,
      size: 'M',
      pinned: false,
      status: 'ready',
      props: {
        meetings: [
          {
            id: 'm1',
            clientId: 'c1',
            clientName: 'Acme',
            title: 'QBR',
            kind: 'qbr',
            startsAt: new Date().toISOString(),
            inHours: 20,
          },
        ],
      },
    },
    {
      id: 'p3',
      componentId: 'overdue_queue',
      need: 'overdue_work',
      zone: 'right',
      order: 0,
      size: 'M',
      pinned: false,
      status: 'ready',
      props: {
        scopeLabel: 'All projects',
        overdueCount: 2,
        tasks: [],
      },
    },
  ],
  receipts: [],
  excluded: [],
  diff: null,
} as unknown as UISpec;

describe('workbench render', () => {
  it('renders overview pieces without throwing', () => {
    const data = extractWorkbench(overviewSpec);
    expect(() =>
      renderToString(
        <TaskHeader intent={overviewSpec.intent} readiness={55} gaps={['One gap']} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToString(<OverviewCanvas data={data} onPrompt={() => {}} />),
    ).not.toThrow();
  });

  it('renders Workbench overview', () => {
    expect(() =>
      renderToString(
        <Workbench spec={overviewSpec} onRunAction={() => {}} onPrompt={() => {}} />,
      ),
    ).not.toThrow();
  });
});
