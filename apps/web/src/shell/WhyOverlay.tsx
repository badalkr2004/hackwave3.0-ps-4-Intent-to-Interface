import { NEED_QUESTIONS, type Need, type Receipt } from '@gestalt/shared';
import { needAdjustment, sizeBecause } from './why';

export function WhyOverlay({ receipt, needs }: { receipt: Receipt; needs: Need[] }) {
  const evidence = receipt.evidence.slice(0, 3);
  const adjustment = needAdjustment(needs, receipt.need);
  return (
    <div className="mx-4 mt-2 rounded-sm bg-accent-bg px-3 py-2 text-xs text-accent-text">
      <p>Answers: {NEED_QUESTIONS[receipt.need]}</p>
      <p className="mt-1 flex items-center gap-2">
        <span className="sr-only">Score {receipt.score.toFixed(2)}. </span>
        <span aria-hidden className="relative h-1.5 w-16 overflow-hidden rounded-full bg-surface">
          <span
            className="absolute inset-y-0 left-0 bg-accent"
            style={{ width: `${Math.round(receipt.score * 100)}%` }}
          />
        </span>
        <span className="font-medium tabular-nums">{receipt.score.toFixed(2)}</span>
        <span className="text-muted">{sizeBecause(receipt.size)}</span>
      </p>
      {evidence.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-muted">
          {evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {adjustment && <p className="mt-1">{adjustment}</p>}
    </div>
  );
}
