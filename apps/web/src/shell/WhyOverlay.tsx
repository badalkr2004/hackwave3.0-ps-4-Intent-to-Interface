import { NEED_QUESTIONS, type Need, type Receipt } from '@gestalt/shared';
import { fitLabel, needAdjustment, sizeBecause } from './why';

export function WhyOverlay({ receipt, needs }: { receipt: Receipt; needs: Need[] }) {
  const evidence = receipt.evidence.slice(0, 2);
  const adjustment = needAdjustment(needs, receipt.need);
  return (
    <div className="mx-4 mt-2 border-l-2 border-accent bg-accent-bg/60 px-3 py-2 text-xs leading-relaxed text-accent-text">
      <p>
        <span className="font-medium">Helps with: </span>
        {NEED_QUESTIONS[receipt.need]}
      </p>
      <p className="mt-1 text-muted">
        {fitLabel(receipt.score)} · {sizeBecause(receipt.size)}
      </p>
      {evidence.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-muted">
          {evidence.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
      {adjustment && <p className="mt-1">{adjustment}</p>}
    </div>
  );
}
