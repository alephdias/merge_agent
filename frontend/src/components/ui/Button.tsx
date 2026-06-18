import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const VARIANTS = {
  primary: { background: '#1976d2', color: '#fff', border: 'none' },
  secondary: { background: '#e3f2fd', color: '#1976d2', border: '1px solid #1976d2' },
  danger: { background: '#f44336', color: '#fff', border: 'none' },
  ghost: { background: 'none', color: '#1976d2', border: 'none' },
};

const SIZES = {
  sm: { padding: '4px 10px', fontSize: 13 },
  md: { padding: '8px 18px', fontSize: 14 },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled ?? loading}
      style={{
        ...VARIANTS[variant],
        ...SIZES[size],
        borderRadius: 4,
        cursor: disabled ?? loading ? 'not-allowed' : 'pointer',
        opacity: disabled ?? loading ? 0.7 : 1,
        ...style,
      }}
      {...rest}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  );
}
