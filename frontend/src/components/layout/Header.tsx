import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <header
      style={{
        background: '#1976d2',
        color: '#fff',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <strong style={{ fontSize: 16, marginRight: 8 }}>Merge Agent</strong>
      <Link style={navLink} to="/">Empresas</Link>
      <Link style={navLink} to="/totvs">Biblioteca TOTVS</Link>
      <Link style={navLink} to="/merges">Histórico</Link>
      <Link style={navLink} to="/merges/novo">Novo Merge</Link>
      <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.8 }}>{user?.nome}</span>
      <button onClick={() => void handleLogout()} style={logoutBtn}>Sair</button>
    </header>
  );
}

const navLink: React.CSSProperties = { color: '#fff', textDecoration: 'none', fontSize: 14, opacity: 0.9 };
const logoutBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,.5)',
  color: '#fff',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 13,
};
