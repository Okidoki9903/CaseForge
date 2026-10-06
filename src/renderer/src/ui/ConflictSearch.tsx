import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchConflicts } from '@shared/domain/conflicts';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Icon } from './primitives';

/** Vérification de conflits instantanée (Ctrl+K), entièrement locale. */
export function ConflictSearch({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.conflictOpen);
  const setOpen = useFirm((s) => s.setConflictOpen);
  const select = useFirm((s) => s.select);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const hits = useMemo(() => (query.trim().length >= 2 ? searchConflicts(query, derived.snapshot) : []), [query, derived.snapshot]);
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-start justify-center bg-slate-900/25 pt-[14vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div className="glass animate-panel w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
          <span className="text-[var(--color-muted)]"><Icon.search /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('conflicts.placeholder')}
            aria-label={t('conflicts.title')}
            className="flex-1 bg-transparent text-base outline-none"
          />
          <kbd className="rounded border border-[var(--color-line)] px-1.5 text-[10px] text-[var(--color-muted)]">Esc</kbd>
        </div>
        <div className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="p-4 text-sm text-[var(--color-muted)]">{t('conflicts.hint')}</p>
          ) : hits.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm font-medium text-emerald-700"><Icon.check /> {t('conflicts.none')}</p>
          ) : (
            hits.map((h) => {
              const adverse = h.roles.some((r) => r.role === 'adverse' || r.role === 'avocat_adverse');
              return (
                <div key={h.party.id} className="rounded-xl p-3 hover:bg-white">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${adverse ? 'bg-[var(--color-critique)]' : 'bg-blue-500'}`}>
                      {adverse ? t('conflicts.potential') : t('conflicts.existingClient')}
                    </span>
                    <span className="font-semibold">{h.party.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--color-muted)]">{t('conflicts.match', { score: Math.round(h.score * 100) })}</span>
                  </div>
                  {h.matchedName !== h.party.name && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">≈ {h.matchedName}</div>}
                  <ul className="mt-1.5 space-y-0.5">
                    {h.roles.map((r) => (
                      <li key={`${r.matter.id}-${r.role}`}>
                        <button
                          type="button"
                          className="text-left text-xs hover:underline"
                          onClick={() => {
                            select({ kind: 'matter', id: r.matter.id });
                            setOpen(false);
                          }}
                        >
                          <b>{t(`partyRole.${r.role}`)}</b> — {r.matter.number} · {r.matter.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
