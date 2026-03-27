import type { Screen, Workflow } from './schema.js';
import type { ValidationIssue, ValidationResult } from './validation-types.js';

export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const screenIds = new Set(screens.map((screen) => screen.screen));

  checkDuplicateWorkflowIds(workflows, issues);
  checkScreenReferences(workflows, screenIds, issues);
  checkEmptySteps(workflows, issues);

  return {
    issues,
    hasErrors: issues.some((issue) => issue.level === 'error'),
  };
}

function checkDuplicateWorkflowIds(workflows: Workflow[], issues: ValidationIssue[]): void {
  const counts = new Map<string, number>();

  for (const workflow of workflows) {
    counts.set(workflow.workflow, (counts.get(workflow.workflow) ?? 0) + 1);
  }

  for (const [workflowId, count] of counts.entries()) {
    if (count > 1) {
      issues.push({
        level: 'error',
        file: toWorkflowFile(workflowId),
        field: 'workflow',
        message: `workflow ID "${workflowId}" が重複しています`,
      });
    }
  }
}

function checkScreenReferences(
  workflows: Workflow[],
  screenIds: Set<string>,
  issues: ValidationIssue[],
): void {
  for (const workflow of workflows) {
    for (const [stepIndex, step] of workflow.steps.entries()) {
      if (!screenIds.has(step.screen)) {
        issues.push({
          level: 'error',
          file: toWorkflowFile(workflow.workflow),
          field: `steps[${stepIndex}].screen`,
          message: `screen "${step.screen}" が見つからない`,
        });
      }
    }
  }
}

function checkEmptySteps(workflows: Workflow[], issues: ValidationIssue[]): void {
  for (const workflow of workflows) {
    const allEmpty = workflow.steps.every((step) => !step.action && !step.expect);
    if (allEmpty) {
      issues.push({
        level: 'warning',
        file: toWorkflowFile(workflow.workflow),
        field: 'steps',
        message: '全ステップが action/expect 未記述です',
      });
    }
  }
}

function toWorkflowFile(workflowId: string): string {
  return `workflows/${workflowId}.yaml`;
}
