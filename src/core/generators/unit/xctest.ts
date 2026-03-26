import type { UnitCase, UnitMethod, UnitSpec } from '../../schema.js';
import type { UnitGenerator } from '../types.js';

export const xctest: UnitGenerator = {
  generate: generateSwiftUnitTestFile,
  fileNameFor: (unitId) => `${toSwiftClassName(unitId)}Tests.swift`,
};

export function generateSwiftUnitTestFile(unit: UnitSpec): string {
  const lines = [
    'import XCTest',
    '',
    `final class ${toSwiftClassName(unit.unit)}Tests: XCTestCase {`,
    ...unit.methods.flatMap((method) => renderMethod(method, 1)),
    '}',
  ];

  return `${lines.join('\n')}\n`;
}

function renderMethod(method: UnitMethod, depth: number): string[] {
  const indent = indentOf(depth);
  const orderedCases = [
    ...method.cases.filter((testCase) => testCase.type === 'normal'),
    ...method.cases.filter((testCase) => testCase.type === 'error'),
    ...method.cases.filter((testCase) => testCase.type === 'boundary'),
  ];

  return [
    '',
    `${indent}// MARK: - ${method.method}`,
    '',
    ...orderedCases.flatMap((testCase) => renderCase(method.method, testCase, depth)),
  ];
}

function renderCase(methodName: string, testCase: UnitCase, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);

  return [
    `${indent}func ${buildFuncName(methodName, testCase)}() {`,
    `${innerIndent}// TODO: implement`,
    `${indent}}`,
  ];
}

function buildFuncName(methodName: string, testCase: UnitCase): string {
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  return `test_${sanitize(methodName)}_${sanitize(testCase.action)}_${sanitize(expectation)}`;
}

function toSwiftClassName(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');
}

function indentOf(depth: number): string {
  return '    '.repeat(depth);
}
