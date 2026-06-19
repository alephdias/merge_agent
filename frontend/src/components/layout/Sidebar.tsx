import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  {
    to: '/', end: true, label: 'Empresas',
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14m16-14v14M8 11h2m4 0h2M8 15h2m4 0h2" /></svg>,
  },
  {
    to: '/totvs', label: 'Biblioteca TOTVS',
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>,
  },
  {
    to: '/merges', label: 'Histórico de Merges',
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>,
  },
];

const S = {
  sidebar: {
    width: 240, flexShrink: 0,
    display: 'flex', flexDirection: 'column' as const,
    minHeight: '100vh',
    background: '#0f1d3a',
    fontFamily: 'Inter, sans-serif',
  },
  logo: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  uploadBtn: {
    margin: '16px 14px',
    height: 38,
    borderRadius: 8,
    border: '1.5px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'Inter, sans-serif',
    transition: 'background 0.15s, border-color 0.15s',
  },
  section: {
    padding: '8px 10px',
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '10px 10px 4px',
  },
  footer: {
    padding: '12px 14px 20px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const initials = user?.nome
    ?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?';

  return (
    <aside style={S.sidebar}>

      {/* Logo */}
      <div style={S.logo}>
        <img
          src="/logo.png"
          alt="Logo"
          style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Botão primário */}
      <button
        style={S.uploadBtn}
        onClick={() => nav('/merges/novo')}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Novo Merge
      </button>

      {/* Nav */}
      <div style={S.section}>
        <p style={S.label}>Menu</p>
        {NAV.map(({ to, end, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(37,99,235,0.35)' : 'transparent',
                border: isActive ? '1px solid rgba(37,99,235,0.4)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
              >
                {icon}
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer — usuário */}
      <div style={S.footer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.nome}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              {user?.empresa_id == null ? 'Admin Global' : 'Analista'}
            </p>
          </div>
          <button
            title="Sair"
            onClick={() => { void logout().then(() => nav('/login')); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
