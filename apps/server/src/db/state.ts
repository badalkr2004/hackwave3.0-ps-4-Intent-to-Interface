export type DbState = 'up' | 'down';

let state: DbState = 'down';

export function getDbState(): DbState {
  return state;
}

export function setDbState(next: DbState): void {
  state = next;
}
