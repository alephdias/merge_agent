import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Mode = 'login' | 'register';

export function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [mode, setMode] = useState<Mode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, senha);
      } else {
        await register(nome, email, senha);
      }
      nav(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,.1)', width: 380 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>Merge Agent NFESEFAZ</h2>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>
          {mode === 'login' ? 'Entre na sua conta' : 'Crie uma conta'}
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          )}
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          {error && <p style={{ color: '#f44336', margin: 0, fontSize: 13 }}>{error}</p>}
          <Button type="submit" loading={loading} style={{ width: '100%', padding: '10px 0' }}>
            {mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
          {mode === 'login' ? (
            <>Sem conta? <button style={linkBtn} onClick={() => setMode('register')}>Cadastre-se</button></>
          ) : (
            <>Já tem conta? <button style={linkBtn} onClick={() => setMode('login')}>Entrar</button></>
          )}
        </p>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0 };
