import type { Screen, Setup } from '../schema.js';

export type Target = 'playwright' | 'xctest';

export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
