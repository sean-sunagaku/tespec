import { playwright } from './playwright.js';
import type { FrameworkGenerator, Target } from './types.js';
import { xctest } from './xctest.js';

const REGISTRY: Record<Target, FrameworkGenerator> = { playwright, xctest };

export function getGenerator(target: Target): FrameworkGenerator {
  return REGISTRY[target];
}

export const AVAILABLE_TARGETS: readonly Target[] = Object.keys(REGISTRY) as Target[];

export function isTarget(value: string): value is Target {
  return (AVAILABLE_TARGETS as readonly string[]).includes(value);
}
