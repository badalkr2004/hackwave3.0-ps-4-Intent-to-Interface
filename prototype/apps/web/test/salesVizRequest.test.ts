import { describe, expect, it } from 'vitest';
import { analyticsUrlFor, parseSalesVizRequest } from '../src/lib/salesVizRequest';

describe('parseSalesVizRequest', () => {
  it('detects sales report as pie chart', () => {
    expect(parseSalesVizRequest('Show me the sales report in a pie chart')).toEqual({
      chart: 'pie',
    });
  });

  it('detects bars and funnel', () => {
    expect(parseSalesVizRequest('sales pipeline as bar chart')?.chart).toBe('bars');
    expect(parseSalesVizRequest('marketing funnel report')?.chart).toBe('funnel');
  });

  it('ignores unrelated prompts', () => {
    expect(parseSalesVizRequest('prepare for Acme meeting')).toBeNull();
  });

  it('builds analytics urls', () => {
    expect(analyticsUrlFor({ chart: 'pie' })).toBe('/analytics?chart=pie');
  });
});
