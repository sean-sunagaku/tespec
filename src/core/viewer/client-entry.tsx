import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Screen, Setup, UnitSpec, Workflow } from '../schema.js';
import { ScreenDetail } from './components/ScreenDetail.js';
import { SetupDetail } from './components/SetupDetail.js';
import { UnitDetail } from './components/UnitDetail.js';
import { WorkflowDetail } from './components/WorkflowDetail.js';

interface SpecsData {
  project: string;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];
}

type View =
  | { type: 'dashboard' }
  | { type: 'screen'; id: string }
  | { type: 'unit'; id: string }
  | { type: 'setup'; id: string }
  | { type: 'workflow'; id: string };

function Badge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    normal: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    boundary: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span class={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100'}`}>
      {type}
    </span>
  );
}

function CoverageSummary({ data }: { data: SpecsData }) {
  const totalCases = data.screens.reduce((sum, s) => sum + s.cases.length, 0);
  const normal = data.screens.reduce(
    (sum, s) => sum + s.cases.filter((c) => c.type === 'normal').length,
    0,
  );
  const error = data.screens.reduce(
    (sum, s) => sum + s.cases.filter((c) => c.type === 'error').length,
    0,
  );
  const boundary = data.screens.reduce(
    (sum, s) => sum + s.cases.filter((c) => c.type === 'boundary').length,
    0,
  );

  return (
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg p-4 border">
        <div class="text-2xl font-bold">{data.screens.length}</div>
        <div class="text-sm text-gray-500">Screens</div>
      </div>
      <div class="bg-white rounded-lg p-4 border">
        <div class="text-2xl font-bold">{data.units.length}</div>
        <div class="text-sm text-gray-500">Units</div>
      </div>
      <div class="bg-white rounded-lg p-4 border">
        <div class="text-2xl font-bold">{data.setups.length}</div>
        <div class="text-sm text-gray-500">Setups</div>
      </div>
      <div class="bg-white rounded-lg p-4 border">
        <div class="text-2xl font-bold">{totalCases}</div>
        <div class="text-sm text-gray-500">Cases</div>
        <div class="flex gap-1 mt-1">
          <span class="text-xs bg-green-100 text-green-800 px-1 rounded">{normal}</span>
          <span class="text-xs bg-red-100 text-red-800 px-1 rounded">{error}</span>
          <span class="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">{boundary}</span>
        </div>
      </div>
    </div>
  );
}

function BrowserApp() {
  const [data, setData] = useState<SpecsData>((window as any).__TESPEC_DATA__);
  const [view, setView] = useState<View>({ type: 'dashboard' });

  useEffect(() => {
    const es = new EventSource('/events');
    es.addEventListener('update', async () => {
      const res = await fetch('/api/specs');
      const newData = await res.json();
      setData(newData);
    });
    es.onerror = () => console.warn('[tespec] SSE disconnected, retrying...');
    return () => es.close();
  }, []);

  function navigate(type: string, id: string) {
    setView({ type: type as View['type'], id } as View);
  }

  function getReferencingScreens(setupId: string) {
    return data.screens.filter((s) =>
      s.cases.some((c) => {
        const given = c.given ? (Array.isArray(c.given) ? c.given : [c.given]) : [];
        return given.includes(setupId);
      }),
    );
  }

  const isEmpty =
    data.screens.length === 0 &&
    data.units.length === 0 &&
    data.setups.length === 0 &&
    data.workflows.length === 0;

  return (
    <div data-testid="app-root" class="flex w-full">
      <nav class="w-64 bg-white border-r p-4 space-y-4 shrink-0">
        {view.type !== 'dashboard' && (
          <button
            onClick={() => setView({ type: 'dashboard' })}
            class="text-sm text-blue-600 hover:underline mb-2"
          >
            ← Dashboard
          </button>
        )}

        {data.screens.length > 0 && (
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Screens
            </h3>
            {data.screens.map((s) => (
              <div
                key={s.screen}
                data-testid={`sidebar-screen-${s.screen}`}
                class={`px-2 py-1.5 rounded cursor-pointer text-sm ${view.type === 'screen' && view.id === s.screen ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                onClick={() => navigate('screen', s.screen)}
              >
                {s.screen}
                <span class="text-xs text-gray-400 ml-1">{s.cases.length}</span>
              </div>
            ))}
          </div>
        )}

        {data.units.length > 0 && (
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Units</h3>
            {data.units.map((u) => (
              <div
                key={u.unit}
                data-testid={`sidebar-unit-${u.unit}`}
                class={`px-2 py-1.5 rounded cursor-pointer text-sm ${view.type === 'unit' && view.id === u.unit ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                onClick={() => navigate('unit', u.unit)}
              >
                {u.unit}
              </div>
            ))}
          </div>
        )}

        {data.setups.length > 0 && (
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Setups
            </h3>
            {data.setups.map((s) => (
              <div
                key={s.setup}
                data-testid={`sidebar-setup-${s.setup.replace(/_/g, '-')}`}
                class={`px-2 py-1.5 rounded cursor-pointer text-sm ${view.type === 'setup' && view.id === s.setup ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                onClick={() => navigate('setup', s.setup)}
              >
                {s.setup}
              </div>
            ))}
          </div>
        )}

        {data.workflows.length > 0 && (
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Workflows
            </h3>
            {data.workflows.map((w) => (
              <div
                key={w.workflow}
                data-testid={`sidebar-workflow-${w.workflow}`}
                class={`px-2 py-1.5 rounded cursor-pointer text-sm ${view.type === 'workflow' && view.id === w.workflow ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                onClick={() => navigate('workflow', w.workflow)}
              >
                {w.workflow}
              </div>
            ))}
          </div>
        )}
      </nav>

      <main class="flex-1 p-6">
        {isEmpty && (
          <div data-testid="empty-state" class="text-gray-400 text-center py-12">
            No specs defined.
          </div>
        )}

        {view.type === 'dashboard' && (
          <>
            <CoverageSummary data={data} />

            {data.screens.length > 0 && (
              <div class="mb-8">
                <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Screens
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.screens.map((s) => {
                    const normal = s.cases.filter((c) => c.type === 'normal').length;
                    const error = s.cases.filter((c) => c.type === 'error').length;
                    const boundary = s.cases.filter((c) => c.type === 'boundary').length;
                    return (
                      <div
                        key={s.screen}
                        class="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group"
                        onClick={() => navigate('screen', s.screen)}
                      >
                        <div class="flex items-start justify-between mb-2">
                          <div class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                            {s.title}
                          </div>
                          <svg
                            class="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors mt-1"
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
                        <div class="text-xs text-gray-400 font-mono mb-3">{s.route}</div>
                        <div class="flex items-center justify-between">
                          <div class="text-sm text-gray-500">{s.cases.length} cases</div>
                          <div class="flex gap-1.5">
                            {normal > 0 && (
                              <span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                {normal}
                              </span>
                            )}
                            {error > 0 && (
                              <span class="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                {error}
                              </span>
                            )}
                            {boundary > 0 && (
                              <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                {boundary}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.units.length > 0 && (
              <div class="mb-8">
                <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Units
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.units.map((u) => {
                    const totalCases = u.methods.reduce((sum, m) => sum + m.cases.length, 0);
                    return (
                      <div
                        key={u.unit}
                        class="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group"
                        onClick={() => navigate('unit', u.unit)}
                      >
                        <div class="flex items-start justify-between mb-2">
                          <div class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                            {u.title}
                          </div>
                          <svg
                            class="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors mt-1"
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
                        <div class="text-xs text-gray-400 font-mono mb-3">{u.unit}</div>
                        <div class="text-sm text-gray-500">
                          {u.methods.length} methods / {totalCases} cases
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.setups.length > 0 && (
              <div class="mb-8">
                <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Setups
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.setups.map((s) => (
                    <div
                      key={s.setup}
                      class="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group"
                      onClick={() => navigate('setup', s.setup)}
                    >
                      <div class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors mb-1">
                        {s.title}
                      </div>
                      <div class="text-xs text-gray-400 font-mono mb-3">{s.setup}</div>
                      <div class="text-sm text-gray-500">{s.steps.length} steps</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.workflows.length > 0 && (
              <div>
                <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Workflows
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.workflows.map((w) => (
                    <div
                      key={w.workflow}
                      class="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group"
                      onClick={() => navigate('workflow', w.workflow)}
                    >
                      <div class="flex items-start justify-between mb-2">
                        <div class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {w.title}
                        </div>
                        <svg
                          class="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors mt-1"
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
                      <div class="text-xs text-gray-400 font-mono mb-3">{w.workflow}</div>
                      <div class="text-sm text-gray-500">{w.steps.length} steps</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {view.type === 'screen' &&
          (() => {
            const s = data.screens.find((sc) => sc.screen === view.id);
            return s ? (
              <ScreenDetail screen={s} setups={data.setups} onNavigate={navigate} />
            ) : null;
          })()}

        {view.type === 'unit' &&
          (() => {
            const u = data.units.find((un) => un.unit === view.id);
            return u ? <UnitDetail unit={u} /> : null;
          })()}

        {view.type === 'setup' &&
          (() => {
            const s = data.setups.find((st) => st.setup === view.id);
            return s ? (
              <SetupDetail
                setup={s}
                referencingScreens={getReferencingScreens(s.setup)}
                onNavigate={navigate}
              />
            ) : null;
          })()}

        {view.type === 'workflow' &&
          (() => {
            const w = data.workflows.find((wf) => wf.workflow === view.id);
            return w ? <WorkflowDetail workflow={w} onNavigate={navigate} /> : null;
          })()}
      </main>
    </div>
  );
}

render(<BrowserApp />, document.getElementById('root')!);
