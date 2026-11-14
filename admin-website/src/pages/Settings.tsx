import { useEffect, useState, type FormEvent } from 'react';
import { api, type AppSettings } from '../api';
import { Card, ErrorBox, Loading } from '../ui';

/** Super-admin only (hidden from the `admin` role in App.tsx). */
export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [appName, setAppName] = useState('');
  const [maxVideoSeconds, setMaxVideoSeconds] = useState(30);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [maintenanceNote, setMaintenanceNote] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.settings();
      const s = res.settings ?? {};
      setSettings(s);
      setAppName(s.appName ?? 'ALIZAIN TIKTOK');
      setMaxVideoSeconds(s.maxVideoSeconds ?? 30);
      setRegistrationOpen(s.registrationOpen ?? true);
      setMaintenanceNote(s.maintenanceNote ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load settings'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      const res = await api.updateSettings({ appName: appName.trim(), maxVideoSeconds, registrationOpen, maintenanceNote: maintenanceNote.trim() });
      setSettings(res.settings ?? null);
      setSuccess('Settings saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading text="Loading settings…" />;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {success ? <div className="success-box">{success}</div> : null}
      <Card title="App settings">
        <form onSubmit={save}>
          <label>App name</label>
          <input value={appName} onChange={(e) => setAppName(e.target.value)} />
          <label>Max video length (seconds)</label>
          <input type="number" min={5} max={300} value={maxVideoSeconds} onChange={(e) => setMaxVideoSeconds(Number(e.target.value))} />
          <label>
            <input type="checkbox" style={{ width: 'auto' }} checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} />
            {' '}Registration open (new users can sign up)
          </label>
          <label>Maintenance note (shown to users when maintenance mode is on)</label>
          <textarea rows={3} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} placeholder="e.g. The app will be down for maintenance tonight." />
          <div style={{ marginTop: 16 }}><button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>
        {settings ? <p className="muted" style={{ marginTop: 14 }}>Current server values are shown above; saving writes them to the backend.</p> : null}
      </Card>
    </div>
  );
}
