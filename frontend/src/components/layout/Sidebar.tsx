import { useState } from 'react';
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
    to: '/totvs/comparativo', label: 'Comparativo TOTVS',
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" /></svg>,
  },
  {
    to: '/merges', label: 'Histórico de Merges',
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>,
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar_collapsed') === 'true',
  );

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  }

  const initials = user?.nome
    ?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?';

  const W = collapsed ? 62 : 240;

  return (
    <aside style={{
      width: W, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
      background: '#0f1d3a',
      fontFamily: 'Inter, sans-serif',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>

      {/* Logo + toggle */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8, minHeight: 60,
      }}>
        {!collapsed && (
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{
            width: 32, height: 32, borderRadius: 7, border: 'none',
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        >
          {collapsed
            ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18" /></svg>
          }
        </button>
      </div>

      {/* Novo Merge button */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 12px' }}>
        <button
          onClick={() => nav('/merges/novo')}
          title="Novo Merge"
          style={{
            width: '100%', height: 38, borderRadius: 8,
            border: '1.5px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: '#fff',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, paddingLeft: collapsed ? 0 : 10,
            fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {!collapsed && 'Novo Merge'}
        </button>
      </div>

      {/* Nav */}
      <div style={{ padding: collapsed ? '4px 8px' : '4px 10px', flex: 1 }}>
        {!collapsed && (
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px 4px' }}>
            Menu
          </p>
        )}
        {NAV.map(({ to, end, label, icon }) => (
          <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: '9px 0', paddingLeft: collapsed ? 0 : 12,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, marginBottom: 2,
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(37,99,235,0.35)' : 'transparent',
                  border: isActive ? '1px solid rgba(37,99,235,0.4)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
              >
                {icon}
                {!collapsed && label}
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer — usuário */}
      <div style={{ padding: collapsed ? '12px 8px 20px' : '12px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: '8px 6px', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          <div
            title={collapsed ? (user?.nome ?? '') : undefined}
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
            {initials}
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
