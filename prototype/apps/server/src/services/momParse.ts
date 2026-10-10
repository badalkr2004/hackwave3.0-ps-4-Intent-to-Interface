import type { MomActionItem } from '../db/auth-schema';

export interface ParsedMom {
  title: string;
  attendees: string[];
  decisions: string[];
  actionItems: Omit<MomActionItem, 'id' | 'status'>[];
  summary: string;
}

const SECTION =
  /^(attendees?|participants?|decisions?|action\s*items?|actions?|next\s*steps?|agenda|notes?|summary)\s*:?\s*$/i;

function bulletText(line: string): string | null {
  const m = line.match(/^\s*(?:[-*•]|\d+[.)]|\[\s*[xX ]?\s*\])\s+(.+)$/);
  return m?.[1]?.trim() || null;
}

function parseOwnerDue(text: string): { text: string; owner: string | null; due: string | null } {
  let owner: string | null = null;
  let due: string | null = null;
  let body = text;

  const ownerMatch = body.match(/\b(?:owner|assignee)\s*[:=]\s*([^,;(]+)/i);
  if (ownerMatch) {
    owner = ownerMatch[1]!.trim();
    body = body.replace(ownerMatch[0], '').trim();
  } else {
    const at = body.match(/@([A-Za-z][\w.-]+)/);
    if (at) owner = at[1]!;
    const paren = body.match(/\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:[-–]\s*)?\)$/);
    if (!owner && paren) {
      owner = paren[1]!;
      body = body.replace(paren[0], '').trim();
    }
  }

  const dueMatch = body.match(/\b(?:due|by)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (dueMatch) {
    due = dueMatch[1]!;
    body = body.replace(dueMatch[0], '').trim();
  }

  body = body.replace(/\s{2,}/g, ' ').replace(/[—–-]\s*$/, '').trim();
  return { text: body || text, owner, due };
}

/** Deterministic MOM parser — works offline; LLM enrichment can refine later. */
export function parseMom(raw: string, fallbackTitle = 'Meeting notes'): ParsedMom {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const attendees: string[] = [];
  const decisions: string[] = [];
  const actionItems: ParsedMom['actionItems'] = [];
  let section: string | null = null;
  let title = '';
  const noteLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!title) {
      const titled = line.match(/^(?:title|meeting|subject)\s*[:=]\s*(.+)$/i);
      if (titled) {
        title = titled[1]!.trim();
        continue;
      }
      if (!SECTION.test(line) && line.length < 90) {
        title = line.replace(/^#+\s*/, '');
        continue;
      }
    }

    if (SECTION.test(line)) {
      section = line.replace(/:$/, '').toLowerCase().replace(/\s+/g, ' ');
      continue;
    }

    const bullet = bulletText(line);
    const content = bullet ?? line;

    if (section?.startsWith('attendee') || section?.startsWith('participant')) {
      for (const part of content.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
        attendees.push(part);
      }
      continue;
    }
    if (section?.startsWith('decision')) {
      decisions.push(content);
      continue;
    }
    if (
      section?.startsWith('action') ||
      section?.startsWith('next step') ||
      /^(todo|action)\b/i.test(content)
    ) {
      const parsed = parseOwnerDue(content.replace(/^(todo|action)\s*[:=-]?\s*/i, ''));
      if (parsed.text) actionItems.push(parsed);
      continue;
    }

    // Heuristic: imperative / will / follow-up lines become actions when no section matched.
    if (
      !section &&
      bullet &&
      /\b(will|follow up|send|schedule|fix|ship|fix|own)\b/i.test(content)
    ) {
      actionItems.push(parseOwnerDue(content));
      continue;
    }

    noteLines.push(content);
  }

  const summary =
    noteLines.slice(0, 3).join(' ') ||
    (decisions[0] ? `Decision: ${decisions[0]}` : '') ||
    (actionItems[0] ? `Next: ${actionItems[0].text}` : 'Minutes captured.');

  return {
    title: title || fallbackTitle,
    attendees: [...new Set(attendees)].slice(0, 24),
    decisions: decisions.slice(0, 20),
    actionItems: actionItems.slice(0, 30),
    summary: summary.slice(0, 400),
  };
}
