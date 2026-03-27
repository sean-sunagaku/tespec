import type { Screen, Setup } from '../../schema.js';

interface SetupDetailProps {
  setup: Setup;
  referencingScreens: Screen[];
  onNavigate: (type: string, id: string) => void;
}

export function SetupDetail({ setup, referencingScreens, onNavigate }: SetupDetailProps) {
  return (
    <div>
      <h2 data-testid="setup-detail-title">{setup.title}</h2>
      <div>{setup.setup}</div>

      <ol>
        {setup.steps.map((step, i) => (
          <li key={i} data-testid={`setup-step-${i}`}>
            {step}
          </li>
        ))}
      </ol>

      {referencingScreens.length > 0 && (
        <div>
          <h3>Referenced by</h3>
          <ul>
            {referencingScreens.map((s) => (
              <li
                key={s.screen}
                data-testid={`ref-screen-${s.screen}`}
                onClick={() => onNavigate('screen', s.screen)}
              >
                {s.screen} ({s.title})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
