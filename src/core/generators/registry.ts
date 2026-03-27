import { playwright } from './screen/playwright.js';
import { vitest as screenVitest } from './screen/vitest.js';
import { xctest as screenXctest } from './screen/xctest.js';
import type { ScreenGenerator, ScreenTarget, UnitGenerator, UnitTarget } from './types.js';
import { vitest } from './unit/vitest.js';
import { xctest as unitXctest } from './unit/xctest.js';

const SCREEN_REGISTRY: Record<ScreenTarget, ScreenGenerator> = {
  playwright,
  vitest: screenVitest,
  xctest: screenXctest,
};

export function getScreenGenerator(target: ScreenTarget): ScreenGenerator {
  return SCREEN_REGISTRY[target];
}

export const SCREEN_TARGETS: readonly ScreenTarget[] = Object.keys(
  SCREEN_REGISTRY,
) as ScreenTarget[];

export function isScreenTarget(value: string): value is ScreenTarget {
  return (SCREEN_TARGETS as readonly string[]).includes(value);
}

const UNIT_REGISTRY: Record<UnitTarget, UnitGenerator> = {
  vitest,
  xctest: unitXctest,
};

export function getUnitGenerator(target: UnitTarget): UnitGenerator {
  return UNIT_REGISTRY[target];
}

export const UNIT_TARGETS: readonly UnitTarget[] = Object.keys(UNIT_REGISTRY) as UnitTarget[];

export function isUnitTarget(value: string): value is UnitTarget {
  return (UNIT_TARGETS as readonly string[]).includes(value);
}
