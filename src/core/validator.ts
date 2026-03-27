import type { Screen, Setup } from './schema.js';
import type { ValidationIssue, ValidationResult } from './validation-types.js';

export type { ValidationIssue, ValidationResult };

export function validate(screens: Screen[], setups: Setup[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const screenIds = new Set(screens.map((screen) => screen.screen));
  const setupIds = new Set(setups.map((setup) => setup.setup));

  checkDuplicateScreenIds(screens, issues);
  checkGivenReferences(screens, setupIds, issues);
  checkStepsReferences(screens, setupIds, issues);
  checkNavigatesToReferences(screens, screenIds, issues);
  checkEmptyCases(screens, issues);
  checkErrorTypeMissing(screens, issues);
  checkBoundaryTypeMissing(screens, issues);

  return {
    issues,
    hasErrors: issues.some((issue) => issue.level === 'error'),
  };
}

function checkDuplicateScreenIds(screens: Screen[], issues: ValidationIssue[]): void {
  const counts = new Map<string, number>();

  for (const screen of screens) {
    counts.set(screen.screen, (counts.get(screen.screen) ?? 0) + 1);
  }

  for (const [screenId, count] of counts.entries()) {
    if (count > 1) {
      issues.push({
        level: 'error',
        file: toScreenFile(screenId),
        field: 'screen',
        message: `screen ID "${screenId}" が重複しています`,
      });
    }
  }
}

function checkGivenReferences(
  screens: Screen[],
  setupIds: Set<string>,
  issues: ValidationIssue[],
): void {
  for (const screen of screens) {
    for (const [index, testCase] of screen.cases.entries()) {
      for (const given of toArray(testCase.given)) {
        if (!setupIds.has(given)) {
          issues.push({
            level: 'error',
            file: toScreenFile(screen.screen),
            field: `cases[${index}].given`,
            message: `given "${given}" → setup が見つからない`,
          });
        }
      }
    }
  }
}

function checkStepsReferences(
  screens: Screen[],
  setupIds: Set<string>,
  issues: ValidationIssue[],
): void {
  for (const screen of screens) {
    for (const [index, testCase] of screen.cases.entries()) {
      for (const [stepIndex, step] of testCase.steps.entries()) {
        const ref = parseUseRef(step);
        if (ref && !setupIds.has(ref)) {
          issues.push({
            level: 'error',
            file: toScreenFile(screen.screen),
            field: `cases[${index}].steps[${stepIndex}]`,
            message: `use:${ref} → setup が見つからない`,
          });
        }
      }
    }
  }
}

function parseUseRef(step: string): string | undefined {
  const match = step.match(/^use:(.+)$/);
  return match ? match[1] : undefined;
}

function checkNavigatesToReferences(
  screens: Screen[],
  screenIds: Set<string>,
  issues: ValidationIssue[],
): void {
  for (const screen of screens) {
    for (const [index, testCase] of screen.cases.entries()) {
      if (testCase.navigates_to && !screenIds.has(testCase.navigates_to)) {
        issues.push({
          level: 'error',
          file: toScreenFile(screen.screen),
          field: `cases[${index}].navigates_to`,
          message: `navigates_to "${testCase.navigates_to}" → screen が見つからない`,
        });
      }
    }
  }
}

function checkEmptyCases(screens: Screen[], issues: ValidationIssue[]): void {
  for (const screen of screens) {
    if (screen.cases.length === 0) {
      issues.push({
        level: 'warning',
        file: toScreenFile(screen.screen),
        field: 'cases',
        message: 'cases が空です',
      });
    }
  }
}

function checkErrorTypeMissing(screens: Screen[], issues: ValidationIssue[]): void {
  for (const screen of screens) {
    if (!screen.cases.some((testCase) => testCase.type === 'error')) {
      issues.push({
        level: 'warning',
        file: toScreenFile(screen.screen),
        field: 'cases',
        message: '異常系 (type: error) が 0 件',
      });
    }
  }
}

function checkBoundaryTypeMissing(screens: Screen[], issues: ValidationIssue[]): void {
  for (const screen of screens) {
    if (!screen.cases.some((testCase) => testCase.type === 'boundary')) {
      issues.push({
        level: 'warning',
        file: toScreenFile(screen.screen),
        field: 'cases',
        message: '境界値 (type: boundary) が 0 件',
      });
    }
  }
}

function toArray(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toScreenFile(screenId: string): string {
  return `screens/${screenId}.yaml`;
}
