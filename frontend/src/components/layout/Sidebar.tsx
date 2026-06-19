import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  {
    to: '/', end: true, label: 'Empresas',
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14m16-14v14M8 11h2m4 0h2M8 15h2m4 0h2" />
      </svg>
    ),
  },
  {
    to: '/totvs', label: 'Biblioteca TOTVS',
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    to: '/merges/novo', label: 'Novo Merge',
    badge: 'new',
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    to: '/merges', label: 'Histórico',
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  const initials = user?.nome
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <aside
      className="flex flex-col w-60 min-h-screen shrink-0 relative"
      style={{
        background: 'linear-gradient(180deg, #1e1b4b 0%, #1a0533 60%, #0f0a1e 100%)',
        borderRight: '1px solid rgba(109,40,217,0.15)',
      }}
    >
      {/* Glow top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.5),transparent)' }} />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3v11.25m0 0A3.75 3.75 0 1 0 11.25 18m-3.75-3.75H18M18 3v2.25m0 0A3.75 3.75 0 1 1 14.25 9M18 5.25H9" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Merge Agent</p>
          <p className="text-[10px] text-indigo-500 leading-tight tracking-widest">NFESEFAZ</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Label */}
      <p className="px-5 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Menu</p>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ to, end, label, icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? 'nav-active font-medium'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`
            }
          >
            {icon}
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider text-indigo-300" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 mt-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* User */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Avatar */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
          >
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate leading-tight">{user?.nome}</p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              {user?.empresa_id == null ? (
                <span className="text-indigo-400">Admin Global</span>
              ) : (
                'Analista'
              )}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={() => void handleLogout()}
            title="Sair"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
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
