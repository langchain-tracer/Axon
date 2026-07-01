const T = { surface: '#0f1117', border: '#1c2030', text: '#ffffff', muted: '#64748b' };

export interface Tab { id: string; label: string; }

export function Tabs({
  tabs, active, onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0, padding: '0 8px',
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '9px 12px', fontSize: 12, cursor: 'pointer',
              color: isActive ? T.text : T.muted,
              borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
              userSelect: 'none',
            }}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
}
