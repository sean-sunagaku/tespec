import { z } from 'zod';

export const CaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  steps: z.array(z.string()).min(1),
  given: z.union([z.string(), z.array(z.string())]).optional(),
  target: z.string().optional(),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
  not_expect: z.array(z.string()).optional(),
  navigates_to: z.string().optional(),
});

export const ScreenSchema = z.object({
  screen: z.string(),
  route: z.string(),
  title: z.string(),
  cases: z.array(CaseSchema),
});

export const SetupSchema = z.object({
  setup: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
});

export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
});

export type Case = z.infer<typeof CaseSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type Setup = z.infer<typeof SetupSchema>;
export type Config = z.infer<typeof ConfigSchema>;
