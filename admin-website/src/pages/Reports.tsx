import { useEffect, useState } from 'react';
import { api, type ReportItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate } from '../ui';

export default function Reports() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.reports(status || undefined); setItems(res.reports ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load reports'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function review(id: string, action: 'dismiss' | 'remove_content' | 'suspend_user') {
    const label = action === 'dismiss' ? 'dismiss this report' : action === 'remove_content' ? 'remove the reported content' : 'suspend the reported user';
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    setBusyId(id);
    try { await api.reviewReport(id, { action, note: note.trim() || undefined }); setNote(''); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All reports</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <button className="btn btn-cyan" onClick={load}>Filter</button>
        <input placeholder="Review note (optional, added to the action)…" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {loading ? <Loading text="Loading reports…" /> : (
        <Card title={`Reports (${items.length})`}>
          {items.length === 0 ? <Empty text="No reports — nobody has reported any content." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Reason</th><th>Target</th><th>Reporter</th><th>Status</th><th>Reported</th><th>Review</th></tr></thead>
              <tbody>{items.map((r) => (
                <tr key={r.id}>
                  <td>{r.reason ?? '—'}</td>
                  <td>{r.targetType ?? '—'}: {r.targetId ?? '—'}</td>
                  <td>@{r.reporter?.username ?? '—'}</td>
                  <td><span className={`badge ${r.status === 'open' ? 'badge-amber' : 'badge-green'}`}>{r.status ?? '—'}</span></td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td><div className="btn-row">
                    <button className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => review(r.id, 'dismiss')}>Dismiss</button>
                    <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => review(r.id, 'remove_content')}>Remove content</button>
                    <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => review(r.id, 'suspend_user')}>Suspend user</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
