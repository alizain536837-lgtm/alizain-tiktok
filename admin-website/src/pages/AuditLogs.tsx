import { useEffect, useMemo, useState } from 'react';
import { api, type AuditLogItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate } from '../ui';

/** Super-admin only (hidden from the `admin` role in App.tsx). */
export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.auditLogs(); setLogs(res.logs ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load audit logs'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      [l.action, l.adminEmail, l.adminId, l.targetType, l.targetId, l.detail]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [logs, filter]);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      <div className="toolbar">
        <input placeholder="Filter by action, admin, target or detail…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {loading ? <Loading text="Loading audit logs…" /> : (
        <Card title={`Audit logs (${filtered.length}${filter ? ` of ${logs.length}` : ''})`}>
          {filtered.length === 0 ? <Empty text="No audit log entries — no admin actions have been recorded yet." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Action</th><th>Admin</th><th>Target</th><th>Detail</th><th>When</th></tr></thead>
              <tbody>{filtered.map((l) => (
                <tr key={l.id}>
                  <td>{l.action ?? '—'}</td>
                  <td>{l.adminEmail ?? l.adminId ?? '—'}</td>
                  <td>{`${l.targetType ?? ''} ${l.targetId ?? ''}`.trim() || '—'}</td>
                  <td>{l.detail ?? '—'}</td>
                  <td>{fmtDate(l.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
