export interface RollingNormalizationConfig {
  window: number;
  minObservations?: number;
}

function validWindow(values: number[], index: number, window: number): number[] {
  const start = Math.max(0, index - window + 1);
  return values.slice(start, index + 1).filter(Number.isFinite);
}

/** Rolling z-score using observations available at the current index only. */
export function rollingZScore(
  values: number[],
  index: number,
  config: RollingNormalizationConfig,
): number | null {
  if (config.window <= 0 || index < 0 || index >= values.length) return null;
  const observations = validWindow(values, index, config.window);
  const minimum = config.minObservations ?? Math.min(config.window, 3);
  if (observations.length < minimum) return null;

  const mean = observations.reduce((sum, value) => sum + value, 0) / observations.length;
  const variance = observations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / observations.length;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation === 0) return 0;
  return (values[index]! - mean) / standardDeviation;
}

/** Rolling percentile rank using observations available at the current index only. */
export function rollingPercentile(
  values: number[],
  index: number,
  config: RollingNormalizationConfig,
): number | null {
  if (config.window <= 0 || index < 0 || index >= values.length) return null;
  const observations = validWindow(values, index, config.window);
  const minimum = config.minObservations ?? Math.min(config.window, 3);
  if (observations.length < minimum || !Number.isFinite(values[index])) return null;
  const lessOrEqual = observations.filter((value) => value <= values[index]!).length;
  return lessOrEqual / observations.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

