import { describe, expect, it } from 'vitest';
import { parseSalesVizRequest, templateNeeds } from '@gestalt/shared';
import { withSalesVizBoost } from '../src/services/needs';

describe('sales viz compose path', () => {
  it('parses pie chart asks', () => {
    expect(parseSalesVizRequest('show me sales report in pie chart')).toEqual({ chart: 'pie' });
    expect(parseSalesVizRequest('Show me the sales report in a pie chart')).toEqual({
      chart: 'pie',
    });
  });

  it('boosts sales_pulse need like a pinned panel', () => {
    const boosted = withSalesVizBoost(templateNeeds('overview'));
    const sales = boosted.find((n) => n.type === 'sales_pulse');
    expect(sales?.priority).toBe(1);
    expect(boosted.find((n) => n.type === 'usage_trend')?.priority).toBeLessThanOrEqual(0.35);
  });
});
