import type { Screen, Setup, UnitSpec } from '../schema.js';

export type ScreenTarget = 'playwright' | 'xctest';

export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}

export type UnitTarget = 'vitest' | 'xctest';

export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}
