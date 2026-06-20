// Small display formatters + per-type visual tokens. No deps.

export function formatCost(cost?: number): string {
  if (!cost) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(t?: { input: number; output: number; total: number }): string {
  if (!t || !t.total) return '—';
  return `${t.total.toLocaleString()} tok`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  // `+(x).toFixed(n)` trims trailing zeros: 5.00s → 5s, 1.90s → 1.9s.
  if (ms < 60000) return `${+(ms / 1000).toFixed(2)}s`;
  return `${+(ms / 60000).toFixed(1)}m`;
}

export function formatTime(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString();
}

/** Tailwind text/border/bg accents per span type. */
export function typeAccent(type: string): { text: string; bg: string; dot: string } {
  switch (type) {
    case 'llm':
      return { text: 'text-violet-300', bg: 'bg-violet-500/10', dot: 'bg-violet-400' };
    case 'tool':
      return { text: 'text-amber-300', bg: 'bg-amber-500/10', dot: 'bg-amber-400' };
    case 'chain':
      return { text: 'text-sky-300', bg: 'bg-sky-500/10', dot: 'bg-sky-400' };
    case 'retriever':
      return { text: 'text-emerald-300', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' };
    case 'agent':
      return { text: 'text-pink-300', bg: 'bg-pink-500/10', dot: 'bg-pink-400' };
    default:
      return { text: 'text-slate-300', bg: 'bg-slate-500/10', dot: 'bg-slate-400' };
  }
}
