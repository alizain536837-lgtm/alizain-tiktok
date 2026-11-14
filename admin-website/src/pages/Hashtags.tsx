import { useEffect, useState } from 'react';
import { api, type HashtagItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtNum } from '../ui';

export default function Hashtags() {
  const [tags, setTags] = useState<HashtagItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.hashtags(); setTags(res.hashtags ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load hashtags'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(tag: string) {
    if (!window.confirm(`Delete the hashtag "${tag}"? Videos keep their captions; only the tag listing is removed.`)) return;
    setBusy(tag);
    try { await api.deleteHashtag(tag); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusy(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {loading ? <Loading text="Loading hashtags…" /> : (
        <Card title={`Hashtags (${tags.length})`}>
          {tags.length === 0 ? <Empty text="No hashtags yet — no video has used a hashtag." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Tag</th><th>Videos</th><th></th></tr></thead>
              <tbody>{tags.map((t) => {
                const tag = t.tag ?? t.name ?? '';
                return (
                  <tr key={tag}>
                    <td>#{tag}</td>
                    <td>{fmtNum(t.count ?? t.videosCount)}</td>
                    <td><button className="btn btn-danger btn-sm" disabled={busy === tag} onClick={() => remove(tag)}>Delete tag</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
