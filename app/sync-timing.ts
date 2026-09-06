export type TrackClock = {
  observedOffsetMs: number;
  referenceTimestampMs: number;
  durationMs: number | null;
};

export type DurationMismatch = {
  differenceMs: number;
  direction: "longer" | "shorter";
};

export const AUTO_RESYNC_DRIFT_MS = 1_500;
export const AUTO_RESYNC_SAMPLE_COUNT = 3;
export const AUTO_RESYNC_COOLDOWN_MS = 8_000;
export const MAX_AUTO_RESYNCS = 3;
export const STABLE_RESET_SAMPLE_COUNT = 20;

export function calculateTargetOffset(
  timing: TrackClock,
  adjustmentMs: number,
  atMs = Date.now(),
) {
  const elapsed = Math.max(0, atMs - timing.referenceTimestampMs);
  const target = Math.max(0, timing.observedOffsetMs + elapsed + adjustmentMs);
  return timing.durationMs
    ? Math.min(target, Math.max(0, timing.durationMs - 250))
    : target;
}

export function shouldAutoResync({
  driftMs,
  consecutiveLargeSamples,
  timeSinceLastCorrectionMs,
  isPlaying,
  correctionCount,
}: {
  driftMs: number;
  consecutiveLargeSamples: number;
  timeSinceLastCorrectionMs: number;
  isPlaying: boolean;
  correctionCount: number;
}) {
  return isPlaying
    && Math.abs(driftMs) >= AUTO_RESYNC_DRIFT_MS
    && consecutiveLargeSamples >= AUTO_RESYNC_SAMPLE_COUNT
    && timeSinceLastCorrectionMs >= AUTO_RESYNC_COOLDOWN_MS
    && correctionCount < MAX_AUTO_RESYNCS;
}

export function detectDurationMismatch(
  recognizedDurationMs: number | null,
  playerDurationSeconds: number,
): DurationMismatch | null {
  if (!recognizedDurationMs || recognizedDurationMs <= 0 || !Number.isFinite(playerDurationSeconds)) {
    return null;
  }

  const playerDurationMs = playerDurationSeconds * 1_000;
  if (playerDurationMs <= 0) return null;

  const signedDifferenceMs = playerDurationMs - recognizedDurationMs;
  const mismatchThresholdMs = Math.max(12_000, recognizedDurationMs * 0.05);
  if (Math.abs(signedDifferenceMs) < mismatchThresholdMs) return null;

  return {
    differenceMs: Math.round(Math.abs(signedDifferenceMs)),
    direction: signedDifferenceMs > 0 ? "longer" : "shorter",
  };
}
