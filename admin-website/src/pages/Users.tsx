import { useEffect, useState } from 'react';
import { api, type AppUser } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate, fmtNum } from '../ui';

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppUser | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.users({ search: search.trim() || undefined, status: status || undefined });
      setUsers(res.users ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load users'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function suspend(id: string) {
    const reason = window.prompt('Reason for suspension (optional):') ?? undefined;
    setBusyId(id);
    try { await api.suspendUser(id, reason || undefined); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Suspend failed'); }
    finally { setBusyId(null); }
  }
  async function restore(id: string) {
    setBusyId(id);
    try { await api.restoreUser(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Restore failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      <div className="toolbar">
        <input placeholder="Search by name, username or email…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn btn-cyan" onClick={load}>Search</button>
      </div>
      {loading ? <Loading text="Loading users…" /> : (
        <Card title={`Users (${users.length})`}>
          {users.length === 0 ? <Empty text="No users yet — nobody has registered on the platform." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>User</th><th>Email</th><th>Status</th><th>Followers</th><th>Videos</th><th>Joined</th><th></th></tr></thead>
              <tbody>{users.map((u) => {
                const suspended = u.suspended === true || u.status === 'suspended';
                return (
                  <tr key={u.id}>
                    <td>@{u.username ?? u.name ?? u.id}</td>
                    <td>{u.email ?? '—'}</td>
                    <td><span className={`badge ${suspended ? 'badge-red' : 'badge-green'}`}>{suspended ? 'Suspended' : 'Active'}</span></td>
                    <td>{fmtNum(u.followersCount)}</td>
                    <td>{fmtNum(u.videosCount)}</td>
                    <td>{fmtDate(u.createdAt)}</td>
                    <td><div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(u)}>View</button>
                      {suspended
                        ? <button className="btn btn-sm" disabled={busyId === u.id} onClick={() => restore(u.id)}>Restore</button>
                        : <button className="btn btn-danger btn-sm" disabled={busyId === u.id} onClick={() => suspend(u.id)}>Suspend</button>}
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>
      )}
      {selected ? (
        <Card title={`User: @${selected.username ?? selected.name ?? selected.id}`}>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>{JSON.stringify(selected, null, 2)}</pre>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
        </Card>
      ) : null}
    </div>
  );
}
