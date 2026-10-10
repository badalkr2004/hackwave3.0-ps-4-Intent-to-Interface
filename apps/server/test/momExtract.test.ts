import { describe, expect, it } from 'vitest';
import { detectMomKind, extractMomText } from '../src/services/momExtract';

describe('momExtract', () => {
  it('detects common kinds', () => {
    expect(detectMomKind('notes.vtt')).toBe('vtt');
    expect(detectMomKind('recap.md')).toBe('markdown');
    expect(detectMomKind('memo.docx')).toBe('docx');
  });

  it('strips VTT cues into plain dialogue', async () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Rohan: Exports are still failing.

2
00:00:05.000 --> 00:00:08.000
We will ship the hotfix by Friday.
`;
    const { text, kind } = await extractMomText({
      filename: 'call.vtt',
      bytes: new TextEncoder().encode(vtt),
    });
    expect(kind).toBe('vtt');
    expect(text).toMatch(/Exports are still failing/);
    expect(text).not.toMatch(/WEBVTT/);
    expect(text).not.toMatch(/-->/);
  });
});
