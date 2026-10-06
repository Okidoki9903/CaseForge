/** Petits composants d'interface réutilisables. */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ALERT_COLORS, type AlertLevel } from '@shared/domain/alerts';

export function LevelBadge({ level, pulse = false }: { level: AlertLevel; pulse?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${pulse ? 'animate-alert' : ''}`}
      style={{ background: ALERT_COLORS[level] }}
    >
      {t(`level.${level}`)}
    </span>
  );
}

export function Countdown({ daysLeft }: { daysLeft: number }) {
  const { t } = useTranslation();
  if (daysLeft < 0) return <>{t('countdown.overdue', { count: -daysLeft })}</>;
  if (daysLeft === 0) return <>{t('countdown.today')}</>;
  return <>{t('countdown.left', { count: daysLeft })}</>;
}

export function Bar({ value, color, max = 1 }: { value: number; color: string; max?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-[var(--color-line)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--color-muted)]">{label}</div>
      <div className="tabular text-sm font-semibold" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

export function IconButton({ onClick, title, children, className = '' }: { onClick: () => void; title: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-white/80 active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/* Icônes SVG en ligne (aucune police d'icônes distante). */
const svg = (d: ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
export const Icon = {
  bell: () => svg(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  lock: () => svg(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 1 1 8 0v4" /></>),
  search: () => svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  close: () => svg(<path d="M18 6 6 18M6 6l12 12" />),
  check: () => svg(<path d="M20 6 9 17l-5-5" />),
  pin: () => svg(<><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></>),
  play: () => svg(<path d="M7 4v16l13-8Z" />),
  stop: () => svg(<rect x="6" y="6" width="12" height="12" rx="1.5" />),
  left: () => svg(<path d="m15 18-6-6 6-6" />),
  right: () => svg(<path d="m9 18 6-6-6-6" />),
  file: () => svg(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>),
  alert: () => svg(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>),
};
