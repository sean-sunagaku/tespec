import type { Case, Screen, Setup } from '../../schema.js';
import type { ScreenGenerator } from '../types.js';

export const vitest: ScreenGenerator = {
  generate: generateTestFile,
  fileNameFor: (screenId) => `${screenId}.test.ts`,
};

export function generateTestFile(screen: Screen, setups: Setup[]): string {
  const setupTitles = new Map(setups.map((setup) => [setup.setup, setup.title]));
  const normalCases = screen.cases.filter((testCase) => testCase.type === 'normal');
  const errorCases = screen.cases.filter((testCase) => testCase.type === 'error');
  const boundaryCases = screen.cases.filter((testCase) => testCase.type === 'boundary');

  const lines = [
    'import { describe, it, expect } from "vitest";',
    '',
    `describe(${quote(screen.title)}, () => {`,
    ...renderCaseGroup(normalCases, setupTitles, 1),
    ...renderNestedGroup('異常系', errorCases, setupTitles, 1),
    ...renderNestedGroup('境界値', boundaryCases, setupTitles, 1),
    '});',
  ];

  return `${lines.join('\n')}\n`;
}

function renderNestedGroup(
  title: string,
  cases: Case[],
  setupTitles: Map<string, string>,
  depth: number,
): string[] {
  if (cases.length === 0) {
    return [];
  }

  const indent = indentOf(depth);

  return [
    `${indent}describe(${quote(title)}, () => {`,
    ...renderCaseGroup(cases, setupTitles, depth + 1),
    `${indent}});`,
  ];
}

function renderCaseGroup(cases: Case[], setupTitles: Map<string, string>, depth: number): string[] {
  return cases.flatMap((testCase) => renderCase(testCase, setupTitles, depth));
}

function renderCase(testCase: Case, setupTitles: Map<string, string>, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);
  const comments = buildComments(testCase, setupTitles, depth + 1);

  return [
    `${indent}it(${quote(buildTestName(testCase))}, () => {`,
    ...comments,
    `${innerIndent}// TODO: implement`,
    `${indent}});`,
  ];
}

function buildTestName(testCase: Case): string {
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  const title = `${testCase.action} → ${expectation}`;

  if (testCase.type === 'normal' || typeof testCase.given === 'undefined') {
    return title;
  }

  const givenValues = Array.isArray(testCase.given) ? testCase.given : [testCase.given];
  return `[${givenValues.join(', ')}] ${title}`;
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
    for (const [index, step] of testCase.steps.entries()) {
      const ref = step.match(/^use:(.+)$/);
      if (ref) {
        const title = setupTitles.get(ref[1]) ?? ref[1];
        comments.push(`${indent}//   ${index + 1}. [use:${ref[1]}] ${title}`);
      } else {
        comments.push(`${indent}//   ${index + 1}. ${step}`);
      }
    }
  }

  if (typeof testCase.navigates_to !== 'undefined') {
    comments.push(`${indent}// navigates_to: ${testCase.navigates_to}`);
  }

  if (Array.isArray(testCase.not_expect)) {
    for (const entry of testCase.not_expect) {
      comments.push(`${indent}// not_expect: ${entry}`);
    }
  }

  return comments;
}

function indentOf(depth: number): string {
  return '  '.repeat(depth);
}

function quote(value: string): string {
  return JSON.stringify(value);
}
