import type { UnitSpec } from '../../schema.js';

function toMethodSlug(method: string): string {
  return method
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

function toCaseSlug(action: string): string {
  const map: Record<string, string> = {
    有効なメールで作成: 'valid-email',
    重複メール: 'duplicate-email',
  };
  return map[action] ?? action.toLowerCase().replace(/\s+/g, '-');
}

const badgeColors: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  boundary: 'bg-amber-100 text-amber-800 border-amber-200',
};

interface UnitDetailProps {
  unit: UnitSpec;
}

export function UnitDetail({ unit }: UnitDetailProps) {
  const totalCases = unit.methods.reduce((sum, m) => sum + m.cases.length, 0);

  return (
    <div>
      <div class="mb-6">
        <h2 data-testid="unit-detail-title" class="text-2xl font-bold text-gray-900">
          {unit.title}
        </h2>
        <div class="text-sm text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">
          {unit.unit}
        </div>
        <div class="text-sm text-gray-400 mt-2">
          {unit.methods.length} methods / {totalCases} cases
        </div>
      </div>

      <div class="space-y-6">
        {unit.methods.map((m) => (
          <div
            key={m.method}
            data-testid={`method-${toMethodSlug(m.method)}`}
            class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div class="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 font-mono">{m.method}()</h3>
              <span class="text-xs text-gray-400">{m.cases.length} cases</span>
            </div>
            <div class="divide-y divide-gray-100">
              {m.cases.map((c) => {
                const slug = toCaseSlug(c.action);
                const expectStr = Array.isArray(c.expect) ? c.expect[0] : c.expect;
                return (
                  <div
                    key={slug}
                    data-testid={`unit-case-${slug}`}
                    class="px-5 py-3 flex items-center gap-3"
                  >
                    <span
                      class={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${badgeColors[c.type] || 'bg-gray-100'}`}
                    >
                      {c.type}
                    </span>
                    <span class="text-sm text-gray-900">{c.action}</span>
                    <svg
                      class="w-4 h-4 text-gray-300 shrink-0"
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
                    <span class="text-sm text-gray-500 font-mono">{expectStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
