import type { UnitSpec } from '../../schema.js';

function toMethodSlug(method: string): string {
  return method.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function toCaseSlug(action: string): string {
  const map: Record<string, string> = {
    '有効なメールで作成': 'valid-email',
    '重複メール': 'duplicate-email',
  };
  return map[action] ?? action.toLowerCase().replace(/\s+/g, '-');
}

interface UnitDetailProps {
  unit: UnitSpec;
}

export function UnitDetail({ unit }: UnitDetailProps) {
  return (
    <div>
      <h2 data-testid="unit-detail-title">{unit.title}</h2>

      {unit.methods.map((m) => (
        <div key={m.method} data-testid={`method-${toMethodSlug(m.method)}`}>
          <h3>{m.method}</h3>
          {m.cases.map((c) => {
            const slug = toCaseSlug(c.action);
            const expectStr = Array.isArray(c.expect) ? c.expect[0] : c.expect;
            return (
              <div key={slug} data-testid={`unit-case-${slug}`}>
                <span>{c.type}</span>
                <span>{c.action}</span>
                <span>→ {expectStr}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
