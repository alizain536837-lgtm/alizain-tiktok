import { useEffect, useState, type FormEvent } from 'react';
import { api, type SoundItem } from '../api';
import { Card, Empty, ErrorBox, Loading, fmtDate, fmtNum } from '../ui';

export default function Music() {
  const [sounds, setSounds] = useState<SoundItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const res = await api.sounds(); setSounds(res.sounds ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load sounds'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!file) { setError('Choose an audio file to upload.'); return; }
    const form = new FormData();
    form.append('title', title.trim());
    if (artist.trim()) form.append('artist', artist.trim());
    form.append('audio', file);
    try {
      await api.addSound(form);
      setSuccess('Sound added.');
      setTitle(''); setArtist(''); setFile(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this sound permanently?')) return;
    setBusyId(id);
    try { await api.deleteSound(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {success ? <div className="success-box">{success}</div> : null}
      <Card title="Add a sound">
        <form onSubmit={add}>
          <label>Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sound title" />
          <label>Artist (optional)</label>
          <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" />
          <label>Audio file</label>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Upload sound</button></div>
        </form>
      </Card>
      {loading ? <Loading text="Loading sounds…" /> : (
        <Card title={`Sounds (${sounds.length})`}>
          {sounds.length === 0 ? <Empty text="No sounds yet — the music library is empty." /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Title</th><th>Artist</th><th>Duration</th><th>Uses</th><th>Added</th><th></th></tr></thead>
              <tbody>{sounds.map((s) => (
                <tr key={s.id}>
                  <td>{s.title ?? s.id}</td>
                  <td>{s.artist ?? '—'}</td>
                  <td>{s.durationSec !== undefined ? `${s.durationSec}s` : '—'}</td>
                  <td>{fmtNum(s.usesCount)}</td>
                  <td>{fmtDate(s.createdAt)}</td>
                  <td><button className="btn btn-danger btn-sm" disabled={busyId === s.id} onClick={() => remove(s.id)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
