import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck } from 'lucide-react';

const VISIBLE_MS = 4000;

// Visual only; the message is announced through the global polite live region.
export function Toast({
  toast,
  onDone,
}: {
  toast: { id: number; message: string } | null;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onDone(toast.id), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  return (
    <div aria-hidden className="pointer-events-none fixed right-4 bottom-24 z-50 sm:bottom-4">
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-2 sheet px-4 py-3 text-sm text-text"
          >
            <CircleCheck className="size-4 text-success" />
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
