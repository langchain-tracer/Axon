import { Bot, Wrench, Link2, BookOpen, Brain, Box, AlertCircle } from 'lucide-react';
import { typeAccent } from '../lib/format';

/** Type/status icon for a span — replaces bare colored dots for faster scanning. */
export function SpanIcon({
  type,
  error,
  className = 'h-4 w-4',
}: {
  type: string;
  error?: boolean;
  className?: string;
}) {
  if (error) return <AlertCircle className={`${className} text-red-400`} />;
  const cls = `${className} ${typeAccent(type).text}`;
  switch (type) {
    case 'llm': return <Bot className={cls} />;
    case 'tool': return <Wrench className={cls} />;
    case 'chain': return <Link2 className={cls} />;
    case 'retriever': return <BookOpen className={cls} />;
    case 'agent': return <Brain className={cls} />;
    default: return <Box className={cls} />;
  }
}
