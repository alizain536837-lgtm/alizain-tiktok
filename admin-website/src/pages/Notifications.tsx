import { useEffect, useState, type FormEvent } from 'react';
import { api, type AnnouncementItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate } from '../ui';

export default function Notifications() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.announcements(); setItems(res.announcements ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load announcements'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!window.confirm('Send this announcement to ALL users?')) return;
    setBusy(true);
    try {
      await api.sendAnnouncement({ title: title.trim(), body: body.trim() });
      setSuccess('Announcement sent to all users.');
      setTitle(''); setBody('');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Send failed'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {success ? <div className="success-box">{success}</div> : null}
      <Card title="Send an announcement to all users">
        <form onSubmit={send}>
          <label>Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          <label>Message</label>
          <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the announcement…" />
          <div style={{ marginTop: 14 }}><button className="btn" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send to all users'}</button></div>
        </form>
      </Card>
      {loading ? <Loading text="Loading announcements…" /> : (
        <Card title={`Past announcements (${items.length})`}>
          {items.length === 0 ? <Empty text="No announcements sent yet." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Title</th><th>Message</th><th>Sent</th></tr></thead>
              <tbody>{items.map((a) => (
                <tr key={a.id}><td>{a.title}</td><td>{a.body}</td><td>{fmtDate(a.createdAt)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
