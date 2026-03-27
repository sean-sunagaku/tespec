import type { Screen, Setup, UnitSpec, Workflow } from '../schema.js';

export type ScreenTarget = 'playwright' | 'vitest' | 'xctest';

export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}

export type UnitTarget = 'vitest' | 'xctest';

export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}

export type WorkflowTarget = 'playwright';

export interface WorkflowGenerator {
  generate(workflow: Workflow): string;
  fileNameFor(workflowId: string): string;
}
