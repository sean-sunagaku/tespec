import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { ScreenDetail } from './components/ScreenDetail.js';
import { UnitDetail } from './components/UnitDetail.js';
import { SetupDetail } from './components/SetupDetail.js';
import type { Screen, Setup, UnitSpec } from '../schema.js';

interface SpecsData {
  project: string;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
}

type View =
  | { type: 'dashboard' }
  | { type: 'screen'; id: string }
  | { type: 'unit'; id: string }
  | { type: 'setup'; id: string };

function Badge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    normal: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    boundary: 'bg-yellow-100 text-yellow-800',
  };
  return <span class={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100'}`}>{type}</span>;
}

function CoverageSummary({ data }: { data: SpecsData }) {
  const totalCases = data.screens.reduce((sum, s) => sum + s.cases.length, 0);
  const normal = data.screens.reduce((sum, s) => sum + s.cases.filter(c => c.type === 'normal').length, 0);
  const error = data.screens.reduce((sum, s) => sum + s.cases.filter(c => c.type === 'error').length, 0);
  const boundary = data.screens.reduce((sum, s) => sum + s.cases.filter(c => c.type === 'boundary').length, 0);

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

  const isEmpty = data.screens.length === 0 && data.units.length === 0 && data.setups.length === 0;

  return (
    <div data-testid="app-root" class="flex w-full">
      <nav class="w-64 bg-white border-r p-4 space-y-4 shrink-0">
        {view.type !== 'dashboard' && (
          <button onClick={() => setView({ type: 'dashboard' })} class="text-sm text-blue-600 hover:underline mb-2">
            ← Dashboard
          </button>
        )}

        {data.screens.length > 0 && (
          <div>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Screens</h3>
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
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Setups</h3>
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
      </nav>

      <main class="flex-1 p-6">
        {isEmpty && <div data-testid="empty-state" class="text-gray-400 text-center py-12">No specs defined.</div>}

        {view.type === 'dashboard' && (
          <>
            <CoverageSummary data={data} />
            <h2 class="text-lg font-semibold mb-3">All Screens</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.screens.map((s) => (
                <div
                  key={s.screen}
                  class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('screen', s.screen)}
                >
                  <div class="font-medium">{s.title}</div>
                  <div class="text-sm text-gray-500">{s.route}</div>
                  <div class="text-sm text-gray-400 mt-1">{s.cases.length} cases</div>
                </div>
              ))}
            </div>
          </>
        )}

        {view.type === 'screen' && (() => {
          const s = data.screens.find((sc) => sc.screen === view.id);
          return s ? <ScreenDetail screen={s} setups={data.setups} onNavigate={navigate} /> : null;
        })()}

        {view.type === 'unit' && (() => {
          const u = data.units.find((un) => un.unit === view.id);
          return u ? <UnitDetail unit={u} /> : null;
        })()}

        {view.type === 'setup' && (() => {
          const s = data.setups.find((st) => st.setup === view.id);
          return s ? (
            <SetupDetail setup={s} referencingScreens={getReferencingScreens(s.setup)} onNavigate={navigate} />
          ) : null;
        })()}
      </main>
    </div>
  );
}

render(<BrowserApp />, document.getElementById('root')!);
