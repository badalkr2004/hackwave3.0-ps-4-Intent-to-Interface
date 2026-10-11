import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className']],
    table: [...(defaultSchema.attributes?.table ?? []), ['className']],
    a: [...(defaultSchema.attributes?.a ?? []), ['className', 'target', 'rel']],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'div',
    'span',
    'section',
    'article',
  ],
};

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-text underline underline-offset-2 hover:opacity-90"
      {...props}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="chat-md-table-wrap my-2 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[240px] border-collapse text-left text-[11px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1.5 font-medium text-text">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-2 py-1.5 align-top text-text">{children}</td>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mt-2 mb-1 text-sm font-semibold text-text">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 mb-1 text-sm font-semibold text-text">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 text-xs font-semibold tracking-wide text-text uppercase">
      {children}
    </h3>
  ),
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-2 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-accent/50 pl-2 text-muted">{children}</blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return (
        <code className={`${className ?? ''} block font-mono text-[11px]`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-accent-text"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="chat-md-pre my-2 overflow-x-auto rounded-md border border-border bg-surface-2 p-2 text-[11px] leading-relaxed">
      {children}
    </pre>
  ),
  // Disposable UI card wrapper when model emits <div class="chat-card">…</div>
  div: ({ className, children, ...props }) => {
    const cls = className ?? '';
    if (cls.includes('chat-card') || cls.includes('ticket-card')) {
      return (
        <div
          className={`chat-block-in my-2 rounded-md border border-border bg-surface px-2.5 py-2 ${cls}`}
          {...props}
        >
          {children}
        </div>
      );
    }
    return (
      <div className={cls || undefined} {...props}>
        {children}
      </div>
    );
  },
};

type Props = {
  content: string;
  streaming?: boolean;
};

/** Renders assistant replies as GitHub-flavored markdown (+ sanitized HTML). */
export function ChatMarkdown({ content, streaming }: Props) {
  return (
    <div className="chat-md text-xs text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="chat-caret" aria-hidden />}
    </div>
  );
}
