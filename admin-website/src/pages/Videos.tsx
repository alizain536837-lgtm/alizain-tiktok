import { useEffect, useState } from 'react';
import { api, type VideoItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate, fmtNum } from '../ui';

export default function Videos() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<VideoItem | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.videos(); setVideos(res.videos ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load videos'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!window.confirm('Remove this video permanently? This cannot be undone.')) return;
    setBusyId(id);
    try { await api.deleteVideo(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {loading ? <Loading text="Loading videos…" /> : (
        <Card title={`Videos (${videos.length})`}>
          {videos.length === 0 ? <Empty text="No videos yet — no creator has uploaded a video." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Caption / title</th><th>Creator</th><th>Views</th><th>Likes</th><th>Comments</th><th>Uploaded</th><th></th></tr></thead>
              <tbody>{videos.map((v) => (
                <tr key={v.id}>
                  <td>{v.caption ?? v.title ?? v.id}</td>
                  <td>@{v.user?.username ?? v.username ?? '—'}</td>
                  <td>{fmtNum(v.views)}</td>
                  <td>{fmtNum(v.likesCount)}</td>
                  <td>{fmtNum(v.commentsCount)}</td>
                  <td>{fmtDate(v.createdAt)}</td>
                  <td><div className="btn-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(v)}>Details</button>
                    <button className="btn btn-danger btn-sm" disabled={busyId === v.id} onClick={() => remove(v.id)}>Remove</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
      {selected ? (
        <Card title="Video details">
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>{JSON.stringify(selected, null, 2)}</pre>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
        </Card>
      ) : null}
    </div>
  );
}
