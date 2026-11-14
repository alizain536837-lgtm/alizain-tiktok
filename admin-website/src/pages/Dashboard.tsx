import { useEffect, useState } from 'react';
import { api, type Stats, type AuditLogItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtBytes, fmtNum } from '../ui';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const [s, l] = await Promise.all([api.stats(), api.auditLogs().catch(() => ({ ok: true, logs: [] as AuditLogItem[] }))]);
      setStats(s.stats);
      setLogs((l.logs ?? []).slice(0, 10));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load dashboard'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Loading text="Loading dashboard…" />;
  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      <div className="grid">
        <div className="stat"><div className="stat-num">{fmtNum(stats?.totalUsers)}</div><div className="stat-label">Total users</div></div>
        <div className="stat"><div className="stat-num">{fmtNum(stats?.totalVideos)}</div><div className="stat-label">Total videos</div></div>
        <div className="stat"><div className="stat-num">{fmtNum(stats?.totalViews)}</div><div className="stat-label">Total views</div></div>
        <div className="stat"><div className="stat-num">{fmtNum(stats?.totalLikes)}</div><div className="stat-label">Total likes</div></div>
        <div className="stat"><div className="stat-num">{fmtNum(stats?.reportsOpen)}</div><div className="stat-label">Open reports</div></div>
        <div className="stat"><div className="stat-num">{fmtBytes(stats?.storageUsedBytes)}</div><div className="stat-label">Storage used</div></div>
      </div>
      <Card title="Recent activity (from audit logs)">
        {logs.length === 0
          ? <Empty text="No activity yet — the platform has no recorded admin actions." />
          : (
            <div className="table-wrap"><table>
              <thead><tr><th>Action</th><th>Admin</th><th>Detail</th><th>When</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action ?? '—'}</td><td>{l.adminEmail ?? l.adminId ?? '—'}</td>
                  <td>{(l.detail ?? `${l.targetType ?? ''} ${l.targetId ?? ''}`.trim()) || '—'}</td>
                  <td>{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
      </Card>
    </div>
  );
}
