import type { UnitCase, UnitMethod, UnitSpec } from '../../schema.js';
import type { UnitGenerator } from '../types.js';

export const vitest: UnitGenerator = {
  generate: generateUnitTestFile,
  fileNameFor: (unitId) => `${unitId}.test.ts`,
};

export function generateUnitTestFile(unit: UnitSpec): string {
  const lines = [
    'import { describe, it, expect } from "vitest";',
    '',
    `describe(${quote(unit.title)}, () => {`,
    ...unit.methods.flatMap((method) => renderMethod(method, 1)),
    '});',
  ];

  return `${lines.join('\n')}\n`;
}

function renderMethod(method: UnitMethod, depth: number): string[] {
  const indent = indentOf(depth);
  const normalCases = method.cases.filter((testCase) => testCase.type === 'normal');
  const errorCases = method.cases.filter((testCase) => testCase.type === 'error');
  const boundaryCases = method.cases.filter((testCase) => testCase.type === 'boundary');

  return [
    `${indent}describe(${quote(method.method)}, () => {`,
    ...renderCaseGroup(normalCases, depth + 1),
    ...renderNestedGroup('異常系', errorCases, depth + 1),
    ...renderNestedGroup('境界値', boundaryCases, depth + 1),
    `${indent}});`,
  ];
}

function renderNestedGroup(title: string, cases: UnitCase[], depth: number): string[] {
  if (cases.length === 0) {
    return [];
  }

  const indent = indentOf(depth);

  return [
    `${indent}describe(${quote(title)}, () => {`,
    ...renderCaseGroup(cases, depth + 1),
    `${indent}});`,
  ];
}

function renderCaseGroup(cases: UnitCase[], depth: number): string[] {
  return cases.flatMap((testCase) => renderCase(testCase, depth));
}

function renderCase(testCase: UnitCase, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);

  return [
    `${indent}it(${quote(buildTestName(testCase))}, () => {`,
    `${innerIndent}// TODO: implement`,
    `${indent}});`,
  ];
}

function buildTestName(testCase: UnitCase): string {
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  return `${testCase.action} → ${expectation}`;
}

function indentOf(depth: number): string {
  return '  '.repeat(depth);
}

function quote(value: string): string {
  return JSON.stringify(value);
}
