import type { KeyboardEvent } from 'preact/compat';
import type { Screen, Setup } from '../../schema.js';

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

interface SetupDetailProps {
  setup: Setup;
  referencingScreens: Screen[];
  onNavigate: (type: string, id: string) => void;
}

export function SetupDetail({ setup, referencingScreens, onNavigate }: SetupDetailProps) {
  return (
    <div>
      <div class="mb-6">
        <h2 data-testid="setup-detail-title" class="text-2xl font-bold text-gray-900">
          {setup.title}
        </h2>
        <div class="text-sm text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">
          {setup.setup}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {setup.steps.map((step, i) => (
          <div
            key={i}
            data-testid={`setup-step-${i}`}
            class="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex gap-3 items-start"
          >
            <span class="bg-gray-900 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span class="text-sm text-gray-700">{step}</span>
          </div>
        ))}
      </div>

      {referencingScreens.length > 0 && (
        <div>
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Referenced by ({referencingScreens.length} screens)
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {referencingScreens.map((s) => (
              <div
                key={s.screen}
                data-testid={`ref-screen-${s.screen}`}
                class="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group flex items-center gap-3"
                {...clickable(() => onNavigate('screen', s.screen))}
              >
                <svg
                  class="w-5 h-5 text-blue-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <div class="text-sm font-medium text-blue-600 group-hover:text-blue-800">
                    {s.screen}
                  </div>
                  <div class="text-xs text-gray-400">{s.title}</div>
                </div>
                <svg
                  class="w-4 h-4 text-gray-300 group-hover:text-blue-400 ml-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
