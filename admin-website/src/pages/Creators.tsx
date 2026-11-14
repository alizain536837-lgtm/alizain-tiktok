import { useEffect, useState } from 'react';
import { api, type CreatorItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtNum } from '../ui';

export default function Creators() {
  const [creators, setCreators] = useState<CreatorItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.creators();
      const list = [...(res.creators ?? [])].sort(
        (a, b) => (b.followersCount ?? b.followers ?? 0) - (a.followersCount ?? a.followers ?? 0),
      );
      setCreators(list);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load creators'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {loading ? <Loading text="Loading creators…" /> : (
        <Card title="Creators — ranked by followers">
          {creators.length === 0 ? <Empty text="No creators yet — nobody has gained followers." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Creator</th><th>Followers</th><th>Total views</th><th>Videos</th></tr></thead>
              <tbody>{creators.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>@{c.username ?? c.name ?? c.id}</td>
                  <td>{fmtNum(c.followersCount ?? c.followers)}</td>
                  <td>{fmtNum(c.views ?? c.totalViews)}</td>
                  <td>{fmtNum(c.videosCount)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
