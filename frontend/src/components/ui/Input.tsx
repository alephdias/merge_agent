import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>}
      <input
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          border: error ? '1px solid #f44336' : '1px solid #ccc',
          fontSize: 14,
          ...style,
        }}
        {...rest}
      />
      {error && <span style={{ color: '#f44336', fontSize: 12 }}>{error}</span>}
    </label>
  );
}
