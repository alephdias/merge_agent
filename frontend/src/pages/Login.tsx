import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth.store';

type Mode = 'login' | 'register';

const EyeOpen = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOff = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

function Input({
  label, type = 'text', value, onChange, placeholder, right,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', height: 44, boxSizing: 'border-box',
            padding: right ? '0 44px 0 14px' : '0 14px',
            fontSize: 14, color: '#111827', background: '#fff',
            border: `1.5px solid ${focused ? '#2563eb' : '#e5e7eb'}`,
            borderRadius: 8, outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        {right && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#9ca3af' }}>
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  function enterDemo() {
    setAuth(
      { id: 'demo', nome: 'Demo User', email: 'demo@preview.dev', empresa_id: null },
      'demo-token',
    );
    nav(from, { replace: true });
  }

  const [mode, setMode] = useState<Mode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, senha);
      else await register(nome, email, senha);
      nav(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>

      {/* ── PAINEL ESQUERDO ── */}
      <div style={{
        width: 420, flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 44px 44px',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(170deg, #bfdbfe 0%, #60a5fa 18%, #2563eb 45%, #1d4ed8 65%, #1e3a8a 100%)',
      }}>
        {/* blobs */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.5), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 60, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.3), transparent 65%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 48, maxWidth: 180, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        </div>

        {/* Copy embaixo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 10, fontWeight: 400 }}>
            Você pode facilmente
          </p>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.35, margin: 0 }}>
            Automatize o merge<br />de fontes TOTVS<br />com inteligência artificial
          </h2>
        </div>
      </div>

      {/* ── PAINEL DIREITO ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'auto' }}>

        {/* Topo */}
        <div style={{ padding: '32px 48px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#2563eb">
            <path d="M11 2h2v7.586l5.293-5.293 1.414 1.414L14.414 11H22v2h-7.586l5.293 5.293-1.414 1.414L14 14.414V22h-2v-7.586l-5.293 5.293-1.414-1.414L10.586 13H2v-2h7.586L4.293 5.707 5.707 4.293 11 9.586V2z" />
          </svg>
        </div>

        {/* Form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 48px 40px' }}>
          <div style={{ width: '100%', maxWidth: 340 }}>

            {/* Asterisco acima do heading */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb" style={{ marginBottom: 14 }}>
              <path d="M11 2h2v7.586l5.293-5.293 1.414 1.414L14.414 11H22v2h-7.586l5.293 5.293-1.414 1.414L14 14.414V22h-2v-7.586l-5.293 5.293-1.414-1.414L10.586 13H2v-2h7.586L4.293 5.707 5.707 4.293 11 9.586V2z" />
            </svg>

            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar uma conta'}
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
              {mode === 'login'
                ? 'Acesse seus projetos e merges a qualquer momento, de qualquer lugar.'
                : 'Comece agora e mantenha tudo organizado em um só lugar.'}
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'register' && (
                <Input label="Seu nome" value={nome} onChange={setNome} placeholder="Aleph Dias" />
              )}

              <Input label="Seu e-mail" type="email" value={email} onChange={setEmail} placeholder="voce@empresa.com" />

              <Input
                label="Senha"
                type={showPass ? 'text' : 'password'}
                value={senha}
                onChange={setSenha}
                placeholder="••••••••••"
                right={
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                    {showPass ? <EyeOff /> : <EyeOpen />}
                  </button>
                }
              />

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: 44, marginTop: 6,
                  borderRadius: 8, border: 'none',
                  background: loading ? '#93c5fd' : '#2563eb',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.45)'; } }}
                onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.3)'; } }}
              >
                {loading && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {loading ? 'Autenticando...' : mode === 'login' ? 'Entrar' : 'Começar agora'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20 }}>
              {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              >
                {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
              </button>
            </p>

            {import.meta.env.DEV && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed #e5e7eb' }}>
                <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Modo Preview
                </p>
                <button
                  onClick={enterDemo}
                  style={{
                    width: '100%', height: 40, borderRadius: 8,
                    border: '1.5px dashed #d1d5db', background: '#f9fafb',
                    color: '#6b7280', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = '#f9fafb'; }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Entrar como Demo (preview only)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
