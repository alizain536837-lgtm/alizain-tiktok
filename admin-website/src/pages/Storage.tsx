import { useEffect, useState } from 'react';
import { api, type StorageInfo } from '../api';
import { Card, ErrorBox, Loading, fmtBytes, fmtNum } from '../ui';

export default function Storage() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.storage(); setInfo(res.storage ?? null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load storage statistics'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Loading text="Loading storage statistics…" />;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {info ? (
        <>
          <div className="grid">
            <div className="stat"><div className="stat-num">{info.provider === 'cloudinary' ? 'Cloudinary' : 'Local disk'}</div><div className="stat-label">Storage provider</div></div>
            <div className="stat"><div className="stat-num">{fmtBytes(info.totalBytes)}</div><div className="stat-label">Total bytes stored</div></div>
            <div className="stat"><div className="stat-num">{fmtBytes(info.videosBytes)}</div><div className="stat-label">Video bytes</div></div>
            <div className="stat"><div className="stat-num">{fmtNum(info.videosCount)}</div><div className="stat-label">Videos stored</div></div>
          </div>
          <Card title="About this storage">
            <p className="muted">
              {info.provider === 'cloudinary'
                ? 'Videos are stored in Cloudinary (configured on the server).'
                : 'Videos are stored on the server’s local disk — Cloudinary is NOT configured. To switch, the owner sets Cloudinary keys in the Netlify environment and redeploys; uploads then go to Cloudinary.'}
            </p>
            {info.note ? <p className="muted">{info.note}</p> : null}
            <p className="muted">Figures come from the live backend — nothing here is estimated or fake.</p>
          </Card>
        </>
      ) : <Card title="Storage"><p className="empty">Storage statistics are not available right now.</p></Card>}
    </div>
  );
}
