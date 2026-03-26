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

export const UnitCaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
});

export const UnitMethodSchema = z.object({
  method: z.string(),
  cases: z.array(UnitCaseSchema),
});

export const UnitSpecSchema = z.object({
  unit: z.string(),
  title: z.string(),
  methods: z.array(UnitMethodSchema),
});

export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().optional(),
});

export type Case = z.infer<typeof CaseSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type Setup = z.infer<typeof SetupSchema>;
export type UnitCase = z.infer<typeof UnitCaseSchema>;
export type UnitMethod = z.infer<typeof UnitMethodSchema>;
export type UnitSpec = z.infer<typeof UnitSpecSchema>;
export type Config = z.infer<typeof ConfigSchema>;
