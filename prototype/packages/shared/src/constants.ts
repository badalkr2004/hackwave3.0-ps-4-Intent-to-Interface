export const SIZE_UNITS = { S: 1, M: 2, L: 3 } as const;
export const ZONE_CAPACITY = { left: 6, center: 8, right: 6 } as const; // in size units
export const SCORE_THRESHOLD = 0.3; // below this -> excluded as low_score
export const SIZE_BREAKS = { L: 0.8, M: 0.5 } as const; // score >= L -> L, >= M -> M, else S
export const CLARIFY_MIN_CONFIDENCE = 0.6;
export const CLARIFY_MIN_GAP = 0.15; // top-two gap below this -> clarify
export const MAX_STACK_DEPTH = 5;
export const PRIORITY_ADJUST_MAX_DELTA = 0.25;
export const MAX_LLM_ADDED_NEEDS = 2;
