import { useState } from 'preact/hooks';
import type { ParsedProject } from '../../parser.js';
import { ScreenDetail } from './ScreenDetail.js';
import { UnitDetail } from './UnitDetail.js';
import { SetupDetail } from './SetupDetail.js';

type View =
  | { type: 'dashboard' }
  | { type: 'screen'; id: string }
  | { type: 'unit'; id: string }
  | { type: 'setup'; id: string };

interface AppProps {
  data: ParsedProject;
}

export function App({ data }: AppProps) {
  const [view, setView] = useState<View>({ type: 'dashboard' });
  const { screens, units, setups } = data;

  function navigate(type: string, id: string) {
    setView({ type: type as View['type'], id } as View);
  }

  function getReferencingScreens(setupId: string) {
    return screens.filter((s) =>
      s.cases.some((c) => {
        const given = c.given ? (Array.isArray(c.given) ? c.given : [c.given]) : [];
        return given.includes(setupId);
      }),
    );
  }

  const isEmpty = screens.length === 0 && units.length === 0 && setups.length === 0;

  return (
    <div data-testid="app-root">
      {/* Sidebar */}
      <nav>
        {screens.length > 0 && (
          <div>
            <h3>Screens</h3>
            {screens.map((s) => (
              <div
                key={s.screen}
                data-testid={`sidebar-screen-${s.screen}`}
                onClick={() => navigate('screen', s.screen)}
              >
                {s.screen}
              </div>
            ))}
          </div>
        )}

        {units.length > 0 && (
          <div>
            <h3>Units</h3>
            {units.map((u) => (
              <div
                key={u.unit}
                data-testid={`sidebar-unit-${u.unit}`}
                onClick={() => navigate('unit', u.unit)}
              >
                {u.unit}
              </div>
            ))}
          </div>
        )}

        {setups.length > 0 && (
          <div>
            <h3>Setups</h3>
            {setups.map((s) => (
              <div
                key={s.setup}
                data-testid={`sidebar-setup-${s.setup.replace(/_/g, '-')}`}
                onClick={() => navigate('setup', s.setup)}
              >
                {s.setup}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Main */}
      <main>
        {isEmpty && <div data-testid="empty-state">No specs defined.</div>}

        {view.type === 'screen' && (() => {
          const s = screens.find((sc) => sc.screen === view.id);
          return s ? <ScreenDetail screen={s} setups={setups} onNavigate={navigate} /> : null;
        })()}

        {view.type === 'unit' && (() => {
          const u = units.find((un) => un.unit === view.id);
          return u ? <UnitDetail unit={u} /> : null;
        })()}

        {view.type === 'setup' && (() => {
          const s = setups.find((st) => st.setup === view.id);
          return s ? (
            <SetupDetail
              setup={s}
              referencingScreens={getReferencingScreens(s.setup)}
              onNavigate={navigate}
            />
          ) : null;
        })()}
      </main>
    </div>
  );
}
