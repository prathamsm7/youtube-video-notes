export const WINDOW_SECONDS = 180;
export const OVERLAP_RATIO = 0.1667; // 30s overlap on 180s windows
export const STEP_SECONDS = WINDOW_SECONDS * (1 - OVERLAP_RATIO);
