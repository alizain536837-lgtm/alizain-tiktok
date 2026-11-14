import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await login(email.trim(), password); }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      // If no super admin exists yet, the backend rejects login — offer setup.
      if (/no admin|not found|no super admin/i.test(msg)) setShowSetup(true);
    } finally { setBusy(false); }
  }

  if (showSetup) return <SetupScreen />;
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>ALIZAIN TIKTOK <span>Admin</span></h1>
        <p>Sign in with your admin account to manage the platform.</p>
        {error ? <div className="error-box"><span>{error}</span></div> : null}
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          <label>Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your admin password" />
          <div style={{ marginTop: 18 }}>
            <button className="btn" disabled={busy} type="submit" style={{ width: '100%' }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        <p style={{ marginTop: 16 }}>
          First time here?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); setShowSetup(true); }}>Set up the Super Admin account</a>
        </p>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const { setup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try { await setup(name.trim(), email.trim(), password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Setup failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>ALIZAIN TIKTOK <span>Admin</span></h1>
        <p><strong>First-use Super Admin setup.</strong> There is no default password — create the owner account now. If a Super Admin already exists, this setup is rejected by the server.</p>
        {error ? <div className="error-box"><span>{error}</span></div> : null}
        <form onSubmit={submit}>
          <label>Full name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Zain" />
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          <label>Password (min 8 characters)</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" />
          <div style={{ marginTop: 18 }}>
            <button className="btn" disabled={busy} type="submit" style={{ width: '100%' }}>
              {busy ? 'Creating…' : 'Create Super Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
