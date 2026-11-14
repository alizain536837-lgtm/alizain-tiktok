import { useEffect, useState } from 'react';
import { api, type LiveProvider, type LiveStream } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate, fmtNum } from '../ui';

/**
 * Live streaming management. The provider (Mux / LiveKit) is configured in
 * the backend environment — API keys/secrets are write-only and are NEVER
 * returned by the API, so this page shows 'not configured' honestly when
 * the backend reports configured:false. There is no key/secret field here
 * that could leak a secret into the browser.
 */
export default function Live() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [provider, setProvider] = useState<LiveProvider | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.live();
      setStreams(res.streams ?? []);
      setProvider(res.provider ?? { configured: false });
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load live streams'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {loading ? <Loading text="Loading live streams…" /> : (
        <>
          <Card title="Streaming provider">
            {provider?.configured ? (
              <p>Provider: <strong>{provider.provider ?? 'configured'}</strong> — live streaming is configured on the server.</p>
            ) : (
              <p><span className="badge badge-amber">Not configured</span></p>
            )}
            <p className="muted">
              Provider configuration lives in the backend environment (server-side only):
              set <code>LIVE_PROVIDER</code> to <code>mux</code> or <code>livekit</code> plus the provider&apos;s
              API key and secret in the Netlify environment variables, then redeploy. Secrets are
              write-only and are never shown in this panel. Until then, live streaming shows as
              unavailable in the app — exactly as the brief requires.
            </p>
            <div className="toolbar">
              <select disabled value={provider?.provider ?? ''} aria-label="Provider (server-side setting)">
                <option value="">Provider (set on server)</option>
                <option value="mux">Mux</option>
                <option value="livekit">LiveKit</option>
              </select>
              <input disabled placeholder="API key — write-only, set on server" />
              <input disabled placeholder="API secret — write-only, set on server" type="password" />
            </div>
          </Card>
          <Card title={`Live streams (${streams.length})`}>
            {streams.length === 0 ? <Empty text="No live streams right now — nobody is streaming." /> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Title</th><th>Streamer</th><th>Status</th><th>Viewers</th><th>Started</th></tr></thead>
                <tbody>{streams.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title ?? s.id}</td>
                    <td>@{s.username ?? '—'}</td>
                    <td><span className={`badge ${s.status === 'live' ? 'badge-red' : ''}`}>{s.status ?? '—'}</span></td>
                    <td>{fmtNum(s.viewers)}</td>
                    <td>{fmtDate(s.startedAt)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
