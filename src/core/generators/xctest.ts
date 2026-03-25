import type { Case, Screen, Setup } from '../schema.js';
import type { FrameworkGenerator } from './types.js';

export const xctest: FrameworkGenerator = {
  generate: generateSwiftTestFile,
  fileNameFor: (screenId) => `${toSwiftClassName(screenId)}Tests.swift`,
};

export function generateSwiftTestFile(screen: Screen, setups: Setup[]): string {
  const setupTitles = new Map(setups.map((setup) => [setup.setup, setup.title]));
  const normalCases = screen.cases.filter((testCase) => testCase.type === 'normal');
  const errorCases = screen.cases.filter((testCase) => testCase.type === 'error');
  const boundaryCases = screen.cases.filter((testCase) => testCase.type === 'boundary');

  const lines = [
    'import XCTest',
    '',
    `final class ${toSwiftClassName(screen.screen)}Tests: XCTestCase {`,
    ...renderCaseGroup(normalCases, setupTitles, 1),
    ...renderMarkedGroup('異常系', errorCases, setupTitles, 1),
    ...renderMarkedGroup('境界値', boundaryCases, setupTitles, 1),
    '}',
  ];

  return `${lines.join('\n')}\n`;
}

function renderMarkedGroup(
  title: string,
  cases: Case[],
  setupTitles: Map<string, string>,
  depth: number,
): string[] {
  if (cases.length === 0) {
    return [];
  }

  const indent = indentOf(depth);

  return ['', `${indent}// MARK: - ${title}`, '', ...renderCaseGroup(cases, setupTitles, depth)];
}

function renderCaseGroup(cases: Case[], setupTitles: Map<string, string>, depth: number): string[] {
  return cases.flatMap((testCase) => renderCase(testCase, setupTitles, depth));
}

function renderCase(testCase: Case, setupTitles: Map<string, string>, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);
  const comments = buildComments(testCase, setupTitles, depth + 1);

  return [
    `${indent}func ${buildFuncName(testCase)}() {`,
    ...comments,
    `${innerIndent}// TODO: implement`,
    `${indent}}`,
  ];
}

function buildFuncName(testCase: Case): string {
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  const base = `test_${sanitize(testCase.action)}_${sanitize(expectation)}`;

  if (testCase.type === 'normal' || typeof testCase.given === 'undefined') {
    return base;
  }

  const givenValues = Array.isArray(testCase.given) ? testCase.given : [testCase.given];
  return `test_${givenValues.map(sanitize).join('_')}_${sanitize(testCase.action)}_${sanitize(expectation)}`;
}

function buildComments(testCase: Case, setupTitles: Map<string, string>, depth: number): string[] {
  const indent = indentOf(depth);
  const comments: string[] = [];

  if (typeof testCase.given !== 'undefined') {
    const givenValues = Array.isArray(testCase.given) ? testCase.given : [testCase.given];
    const resolved = givenValues.map((given) => setupTitles.get(given) ?? given);
    comments.push(`${indent}// Given: ${resolved.join(', ')}`);
  }

  if (testCase.steps.length > 0) {
    comments.push(`${indent}// Steps:`);
    for (const [i, step] of testCase.steps.entries()) {
      const ref = step.match(/^use:(.+)$/);
      if (ref) {
        const title = setupTitles.get(ref[1]) ?? ref[1];
        comments.push(`${indent}//   ${i + 1}. [use:${ref[1]}] ${title}`);
      } else {
        comments.push(`${indent}//   ${i + 1}. ${step}`);
      }
      if (i < testCase.steps.length - 1) {
        comments.push('');
      }
    }
  }

  if (Array.isArray(testCase.not_expect)) {
    for (const entry of testCase.not_expect) {
      comments.push(`${indent}// not_expect: ${entry}`);
    }
  }

  return comments;
}

function toSwiftClassName(screenId: string): string {
  return screenId
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
