import type { UnitSpec } from './schema.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasErrors: boolean;
}

export function validateUnits(units: UnitSpec[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  checkDuplicateUnitIds(units, issues);
  checkEmptyMethods(units, issues);
  checkEmptyCases(units, issues);
  checkErrorTypeMissing(units, issues);
  checkBoundaryTypeMissing(units, issues);

  return {
    issues,
    hasErrors: issues.some((issue) => issue.level === 'error'),
  };
}

function checkDuplicateUnitIds(units: UnitSpec[], issues: ValidationIssue[]): void {
  const counts = new Map<string, number>();

  for (const unit of units) {
    counts.set(unit.unit, (counts.get(unit.unit) ?? 0) + 1);
  }

  for (const [unitId, count] of counts.entries()) {
    if (count > 1) {
      issues.push({
        level: 'error',
        file: toUnitFile(unitId),
        field: 'unit',
        message: `unit ID "${unitId}" が重複しています`,
      });
    }
  }
}

function checkEmptyMethods(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    if (unit.methods.length === 0) {
      issues.push({
        level: 'warning',
        file: toUnitFile(unit.unit),
        field: 'methods',
        message: 'methods が空です',
      });
    }
  }
}

function checkEmptyCases(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [index, method] of unit.methods.entries()) {
      if (method.cases.length === 0) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${index}].cases`,
          message: 'cases が空です',
        });
      }
    }
  }
}

function checkErrorTypeMissing(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [index, method] of unit.methods.entries()) {
      if (!method.cases.some((testCase) => testCase.type === 'error')) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${index}].cases`,
          message: '異常系 (type: error) が 0 件',
        });
      }
    }
  }
}

function checkBoundaryTypeMissing(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [index, method] of unit.methods.entries()) {
      if (!method.cases.some((testCase) => testCase.type === 'boundary')) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${index}].cases`,
          message: '境界値 (type: boundary) が 0 件',
        });
      }
    }
  }
}

function toUnitFile(unitId: string): string {
  return `units/${unitId}.yaml`;
}
