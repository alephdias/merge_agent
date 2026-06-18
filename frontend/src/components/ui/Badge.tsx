import type { ReactNode, CSSProperties } from 'react';

const COLORS: Record<string, string> = {
  pending: '#ff9800',
  processing: '#2196f3',
  done: '#4caf50',
  error: '#f44336',
  default: '#9e9e9e',
};

interface BadgeProps {
  label: ReactNode;
  color?: string;
  variant?: string;
}

export function Badge({ label, color, variant }: BadgeProps) {
  const bg = color ?? COLORS[variant ?? ''] ?? COLORS['default'];
  const style: CSSProperties = {
    display: 'inline-block',
    background: bg,
    color: '#fff',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 500,
  };
  return <span style={style}>{label}</span>;
}
