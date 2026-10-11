import { describe, expect, it } from 'vitest';
import {
  applyClientPolicy,
  assertCapability,
  canAccessClient,
  capabilitiesFor,
  filterJiraIssuesForRole,
  filterNeedsForRole,
  isPanelAllowed,
  resolveAccessRole,
  scopeLabelForRole,
  ticketMatchesRole,
} from '../src/services/accessPolicy';

describe('accessPolicy', () => {
  it('applies intern client allow-list', () => {
    const ids = applyClientPolicy(['acme', 'globex', 'initech'], 'intern');
    expect(ids).toEqual(['acme']);
  });

  it('leaves manager and developer portfolio intact', () => {
    const all = ['acme', 'globex'] as const;
    expect(applyClientPolicy(all, 'manager')).toEqual([...all]);
    expect(applyClientPolicy(all, 'developer')).toEqual([...all]);
  });

  it('gates capabilities per role', () => {
    expect(capabilitiesFor('manager').writeConnectors).toBe(true);
    expect(capabilitiesFor('developer').writeConnectors).toBe(false);
    expect(capabilitiesFor('developer').readConnectors).toBe(true);
    expect(capabilitiesFor('intern').jiraLive).toBe(false);
    expect(capabilitiesFor('intern').sales).toBe(false);
    expect(assertCapability('intern', 'writeConnectors').ok).toBe(false);
    expect(assertCapability('manager', 'writeConnectors').ok).toBe(true);
  });

  it('excludes jira/open_issues panels for intern', () => {
    expect(isPanelAllowed('jira_tickets', 'intern')).toBe(false);
    expect(isPanelAllowed('open_issues', 'intern')).toBe(false);
    expect(isPanelAllowed('jira_tickets', 'developer')).toBe(true);
    expect(isPanelAllowed('sales_pulse', 'developer')).toBe(false);
  });

  it('defaults missing accessRole to intern', () => {
    expect(resolveAccessRole(null)).toBe('intern');
    expect(resolveAccessRole(undefined)).toBe('intern');
    expect(resolveAccessRole('manager')).toBe('manager');
  });

  it('filters needs for intern', () => {
    const needs = filterNeedsForRole(
      [
        { type: 'open_issues', question: 'What is open?', priority: 0.9, source: 'template' },
        { type: 'usage_trend', question: 'Usage?', priority: 0.8, source: 'template' },
      ],
      'intern',
    );
    expect(needs.map((n) => n.type)).toEqual(['usage_trend']);
  });

  it('matches story tickets by mode', () => {
    expect(ticketMatchesRole(['bug', 'api'], 'developer')).toBe(true);
    expect(ticketMatchesRole(['billing'], 'developer')).toBe(false);
    expect(ticketMatchesRole(['billing'], 'intern')).toBe(true);
    expect(ticketMatchesRole(['bug'], 'intern')).toBe(false);
    expect(ticketMatchesRole(['billing'], 'manager')).toBe(true);
  });

  it('filters jira issues for roles', () => {
    const issues = [
      { issueType: 'Bug', summary: 'x' },
      { issueType: 'Support', summary: 'y' },
      { issueType: 'Task', summary: 'z' },
    ];
    expect(filterJiraIssuesForRole(issues, 'intern')).toEqual([]);
    expect(filterJiraIssuesForRole(issues, 'developer').map((i) => i.issueType)).toEqual([
      'Bug',
      'Task',
    ]);
    expect(filterJiraIssuesForRole(issues, 'manager')).toHaveLength(3);
  });

  it('canAccessClient respects allow-list and null client', () => {
    expect(canAccessClient('acme', 'intern', ['acme'])).toBe(true);
    expect(canAccessClient('globex', 'intern', ['acme'])).toBe(false);
    expect(canAccessClient(null, 'intern', ['acme'])).toBe(false);
    expect(canAccessClient(null, 'manager', ['acme', 'globex'])).toBe(true);
  });

  it('builds scope labels', () => {
    expect(scopeLabelForRole('intern', ['acme'])).toContain('acme');
    expect(scopeLabelForRole('developer', ['acme', 'globex'])).toContain('no sales');
    expect(scopeLabelForRole('manager', ['acme', 'globex'])).toContain('Portfolio');
  });
});
