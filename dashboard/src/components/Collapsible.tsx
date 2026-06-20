import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/** A labelled section that can be expanded/collapsed. Defaults to open. */
export function Collapsible({
  title,
  defaultOpen = true,
  right,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-200"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
        </span>
        {right}
      </button>
      {open && <div className="border-t border-slate-800 px-3 py-2">{children}</div>}
    </div>
  );
}
