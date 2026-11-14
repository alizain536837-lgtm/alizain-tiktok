import { useEffect, useState } from 'react';
import { api, type CommentItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate } from '../ui';

export default function Comments() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.comments(); setItems(res.comments ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load comments'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!window.confirm('Delete this comment permanently?')) return;
    setBusyId(id);
    try { await api.deleteComment(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {loading ? <Loading text="Loading comments…" /> : (
        <Card title={`Comments (${items.length})`}>
          {items.length === 0 ? <Empty text="No comments yet — nobody has commented on a video." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Comment</th><th>User</th><th>Video</th><th>Posted</th><th></th></tr></thead>
              <tbody>{items.map((c) => (
                <tr key={c.id}>
                  <td>{c.body ?? c.text ?? '—'}</td>
                  <td>@{c.user?.username ?? c.user?.name ?? '—'}</td>
                  <td>{c.videoId ?? '—'}</td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td><button className="btn btn-danger btn-sm" disabled={busyId === c.id} onClick={() => remove(c.id)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
