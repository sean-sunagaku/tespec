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

function toSlug(action: string): string {
  const map: Record<string, string> = {
    画面を開く: 'open-page',
    ログインする: 'login',
    誤った認証情報: 'wrong-credentials',
    '256文字メール': 'long-email',
    オフラインで開く: 'open-offline',
  };
  return map[action] ?? action.toLowerCase().replace(/\s+/g, '-');
}

const badgeColors: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  boundary: 'bg-amber-100 text-amber-800 border-amber-200',
};

interface ScreenDetailProps {
  screen: Screen;
  setups: Setup[];
  onNavigate: (type: string, id: string) => void;
}

export function ScreenDetail({ screen, setups, onNavigate }: ScreenDetailProps) {
  const normal = screen.cases.filter((c) => c.type === 'normal');
  const error = screen.cases.filter((c) => c.type === 'error');
  const boundary = screen.cases.filter((c) => c.type === 'boundary');

  return (
    <div>
      <div class="mb-6">
        <h2 data-testid="screen-detail-title" class="text-2xl font-bold text-gray-900">
          {screen.title}
        </h2>
        <div
          data-testid="screen-detail-route"
          class="text-sm text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded"
        >
          {screen.route}
        </div>
        <div class="flex gap-3 mt-3">
          <span class="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
            {normal.length} normal
          </span>
          <span class="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full">
            {error.length} error
          </span>
          <span class="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
            {boundary.length} boundary
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {screen.cases.map((c, ci) => {
          const slug = toSlug(c.action);
          const expectList = Array.isArray(c.expect) ? c.expect : [c.expect];

          return (
            <div
              key={ci}
              data-testid={`case-${slug}`}
              class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div class="px-5 py-4 flex-1">
                <div class="flex items-center gap-2 mb-3">
                  <span
                    data-testid={`case-badge-${c.type}-${slug}`}
                    class={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColors[c.type] || 'bg-gray-100'}`}
                  >
                    {c.type}
                  </span>
                  <span class="font-medium text-gray-900 text-sm">{c.action}</span>
                </div>

                {c.given && (
                  <div class="flex items-center gap-2 mb-3 text-xs">
                    <span class="text-gray-400 font-medium">Given:</span>
                    {(Array.isArray(c.given) ? c.given : [c.given]).map((g) => (
                      <span
                        key={g}
                        data-testid={`given-link-${g.replace(/_/g, '-')}`}
                        class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                        {...clickable(() => onNavigate('setup', g))}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <div class="bg-gray-50 rounded-lg p-3 mb-3">
                  <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Steps
                  </div>
                  <ol class="space-y-0.5">
                    {c.steps.map((step, si) => (
                      <li
                        key={si}
                        data-testid={`case-step-${ci}-${si}`}
                        class="flex gap-2 text-xs text-gray-600"
                      >
                        <span class="text-gray-400 font-mono">{si + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div class="text-xs">
                  <span class="text-gray-400 font-medium">Expect: </span>
                  <span class="text-gray-700">{expectList.join(' / ')}</span>
                </div>
              </div>

              {c.navigates_to && (
                <div class="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                  <span
                    data-testid={`navigates-to-${c.navigates_to}`}
                    class="inline-flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-800 transition-colors"
                    {...clickable(() => onNavigate('screen', c.navigates_to as string))}
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                    {c.navigates_to}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
