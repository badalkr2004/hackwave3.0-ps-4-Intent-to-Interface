// Lets focus management avoid stealing focus from someone typing their next request.
let lastEdit = 0;

export function markIntentEdited(): void {
  lastEdit = performance.now();
}

export function intentEditedSince(t: number): boolean {
  return lastEdit > t;
}

export function isTypingTarget(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  );
}
