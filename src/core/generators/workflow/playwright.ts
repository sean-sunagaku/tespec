import type { Workflow, WorkflowStep } from '../../schema.js';
import type { WorkflowGenerator } from '../types.js';

function formatStep(step: WorkflowStep, index: number): string {
  const num = index + 1;
  const lines: string[] = [];

  if (step.action) {
    lines.push(`  // Step ${num}: ${step.screen} — ${step.action}`);
  } else {
    lines.push(`  // Step ${num}: ${step.screen}`);
  }

  if (step.expect) {
    lines.push(`  // expect: ${step.expect}`);
  }

  lines.push('  // TODO: implement');

  return lines.join('\n');
}

function generateWorkflowTestFile(workflow: Workflow): string {
  const steps = workflow.steps.map((step, i) => formatStep(step, i)).join('\n\n');

  return `import { test, expect } from "@playwright/test";

test("${workflow.title}", async ({ page }) => {
${steps}

});
`;
}

export const playwright: WorkflowGenerator = {
  generate: generateWorkflowTestFile,
  fileNameFor: (workflowId) => `${workflowId}.spec.ts`,
};
