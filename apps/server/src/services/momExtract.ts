/** Pull plain text from common meeting export formats (no native binary parsers). */

function stripVtt(raw: string): string {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === 'WEBVTT' || t.startsWith('NOTE')) continue;
    if (/^\d+$/.test(t)) continue;
    if (/^\d{2}:\d{2}/.test(t) && t.includes('-->')) continue;
    out.push(t.replace(/<[^>]+>/g, ''));
  }
  return out.join('\n');
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Very small DOCX reader: unzip and read word/document.xml (UTF-8). */
async function extractDocx(buf: Uint8Array): Promise<string> {
  // Dynamic import keeps the dependency optional at typecheck time if unavailable.
  const { unzipSync } = await import('fflate');
  const files = unzipSync(buf);
  const xmlBytes = files['word/document.xml'];
  if (!xmlBytes) throw new Error('Not a valid .docx file.');
  const xml = new TextDecoder().decode(xmlBytes);
  const withBreaks = xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n');
  return stripHtml(withBreaks);
}

export type MomFileKind = 'text' | 'markdown' | 'vtt' | 'html' | 'docx';

export function detectMomKind(filename: string, mime?: string): MomFileKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.vtt') || mime === 'text/vtt') return 'vtt';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm') || mime === 'text/html') return 'html';
  if (lower.endsWith('.docx') || mime?.includes('wordprocessingml')) return 'docx';
  return 'text';
}

export async function extractMomText(opts: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): Promise<{ text: string; kind: MomFileKind }> {
  const kind = detectMomKind(opts.filename, opts.mime);
  if (kind === 'docx') {
    const text = await extractDocx(opts.bytes);
    if (text.length < 40) throw new Error('Could not read enough text from the Word file.');
    return { text, kind };
  }
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(opts.bytes);
  let text = raw;
  if (kind === 'vtt') text = stripVtt(raw);
  else if (kind === 'html') text = stripHtml(raw);
  text = text.trim();
  if (text.length < 40) throw new Error('File did not contain enough meeting text.');
  if (text.length > 80_000) throw new Error('File text is too long (80k character limit).');
  return { text, kind };
}
