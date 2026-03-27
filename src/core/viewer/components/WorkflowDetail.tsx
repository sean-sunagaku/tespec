import type { KeyboardEvent } from 'preact/compat';
import type { Workflow } from '../../schema.js';

type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';

function clickable(handler: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handler();
    },
  };
}

interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: ViewType, id: string) => void;
}

export function WorkflowDetail({ workflow, onNavigate }: WorkflowDetailProps) {
  return (
    <div>
      <div class="mb-6">
        <h2 data-testid="workflow-detail-title" class="text-2xl font-bold text-gray-900">
          {workflow.title}
        </h2>
        <div class="text-sm text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">
          {workflow.workflow}
        </div>
        <div class="text-sm text-gray-400 mt-2">{workflow.steps.length} steps</div>
      </div>

      <div class="space-y-4">
        {workflow.steps.map((step, i) => (
          <div
            key={i}
            data-testid={`workflow-step-${i}`}
            class="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex gap-4 items-start"
          >
            <span class="bg-gray-900 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div class="flex-1 space-y-2">
              <div>
                <span
                  class="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-800 transition-colors"
                  {...clickable(() => onNavigate('screen', step.screen))}
                >
                  {step.screen}
                </span>
              </div>
              {step.action && (
                <div class="text-sm text-gray-700">
                  <span class="text-gray-400 font-medium">Action: </span>
                  {step.action}
                </div>
              )}
              {step.expect && (
                <div class="text-sm text-gray-700">
                  <span class="text-gray-400 font-medium">Expect: </span>
                  {step.expect}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
