import type { Screen, Setup } from '../../schema.js';

function toSlug(action: string): string {
  const map: Record<string, string> = {
    '画面を開く': 'open-page',
    'ログインする': 'login',
    '誤った認証情報': 'wrong-credentials',
    '256文字メール': 'long-email',
    'オフラインで開く': 'open-offline',
  };
  return map[action] ?? action.toLowerCase().replace(/\s+/g, '-');
}

interface ScreenDetailProps {
  screen: Screen;
  setups: Setup[];
  onNavigate: (type: string, id: string) => void;
}

export function ScreenDetail({ screen, setups, onNavigate }: ScreenDetailProps) {
  return (
    <div>
      <h2 data-testid="screen-detail-title">{screen.title}</h2>
      <div data-testid="screen-detail-route">{screen.route}</div>

      <div>
        {screen.cases.map((c, ci) => {
          const slug = toSlug(c.action);
          return (
            <div key={ci} data-testid={`case-${slug}`}>
              <span data-testid={`case-badge-${c.type}-${slug}`}>{c.type}</span>
              <span>{c.action}</span>

              {c.given && (
                <div>
                  {(Array.isArray(c.given) ? c.given : [c.given]).map((g) => (
                    <span
                      key={g}
                      data-testid={`given-link-${g.replace(/_/g, '-')}`}
                      onClick={() => onNavigate('setup', g)}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <ol>
                {c.steps.map((step, si) => (
                  <li key={si} data-testid={`case-step-${ci}-${si}`}>
                    {step}
                  </li>
                ))}
              </ol>

              <div>
                {(Array.isArray(c.expect) ? c.expect : [c.expect]).map((e, ei) => (
                  <div key={ei}>{e}</div>
                ))}
              </div>

              {c.navigates_to && (
                <span
                  data-testid={`navigates-to-${c.navigates_to}`}
                  onClick={() => onNavigate('screen', c.navigates_to!)}
                >
                  → {c.navigates_to}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
