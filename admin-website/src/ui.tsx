import type { ReactNode } from 'react';

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="card">
      {title ? <h2 className="card-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <span>{message}</span>
      {onRetry ? <button className="btn btn-ghost" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <p className="loading">{text}</p>;
}

export function fmtBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fmtNum(n?: number): string {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-US');
}

export function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}
