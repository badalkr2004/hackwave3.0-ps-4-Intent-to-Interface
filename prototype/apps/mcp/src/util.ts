/** JSON tool result for MCP (stdout is reserved for the protocol — never console.log). */
export function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}

/** Keep LLM context small for MoM bodies. */
export function truncate(text: string | null | undefined, max = 2_000): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated ${text.length - max} chars]`;
}
