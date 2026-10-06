/**
 * Vérification de conflits (Ctrl+K), entièrement locale.
 *
 * Chaque recherche est enregistrée automatiquement dans `conflict_checks` dès que
 * l'utilisateur cesse de taper (preuve de diligence), avec un statut modifiable :
 * En cours · Clair · Conflit potentiel · Conflit confirmé.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizedQuery, searchConflicts } from '@shared/domain/conflicts';
import type { ConflictCheck, Id } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { formatWhen } from '../lib/format';
import { Icon } from './primitives';
import { ConflictStatusSelect } from './ConflictStatusSelect';

/** Délai d'inactivité avant l'enregistrement automatique. */
const RECORD_AFTER_MS = 1200;

export function ConflictSearch({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const open = useFirm((s) => s.conflictOpen);
  const setOpen = useFirm((s) => s.setConflictOpen);
  const select = useFirm((s) => s.select);
  const record = useFirm((s) => s.recordConflictCheck);
  const update = useFirm((s) => s.updateConflictCheck);
  const [query, setQuery] = useState('');
  const [targetMatter, setTargetMatter] = useState<Id | ''>('');
  const [currentId, setCurrentId] = useState<Id | null>(null);
  const [pending, setPending] = useState(false);
  const lastRecorded = useRef('');

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

  // Nouvelle session de recherche à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCurrentId(null);
    lastRecorded.current = '';
  }, [open]);

  // Enregistrement automatique après une pause de frappe (une seule trace par requête distincte).
  useEffect(() => {
    if (!open) return;
    const key = normalizedQuery(query);
    if (key.length < 3 || key === lastRecorded.current) {
      setPending(false);
      return;
    }
    setPending(true);
    const id = setTimeout(async () => {
      lastRecorded.current = key;
      const check = await record(query, targetMatter || null);
      setPending(false);
      if (check) setCurrentId(check.id);
    }, RECORD_AFTER_MS);
    return () => clearTimeout(id);
    // `targetMatter` est appliqué via `update` ci-dessous une fois la trace créée.
  }, [query, open, record]);

  const hits = useMemo(() => (query.trim().length >= 2 ? searchConflicts(query, derived.snapshot) : []), [query, derived.snapshot]);
  const checks = derived.snapshot.conflictChecks;
  const current = checks.find((c) => c.id === currentId) ?? null;
  if (!open) return null;

  const matters = derived.snapshot.matters.filter((m) => m.status !== 'ferme');

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-start justify-center bg-slate-900/25 pt-[10vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div className="glass animate-panel w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
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

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-4 py-2 text-[11px]">
          <label className="flex items-center gap-1.5 text-[var(--color-muted)]">
            {t('conflicts.targetMatter')}
            <select
              value={targetMatter}
              onChange={(e) => {
                setTargetMatter(e.target.value);
                if (current) void update(current.id, { matterId: e.target.value || null });
              }}
              className="h-6 max-w-[260px] rounded-md border border-[var(--color-line)] bg-white px-1 text-[11px] text-[var(--color-ink)] outline-none"
            >
              <option value="">{t('conflicts.noMatter')}</option>
              {matters.map((m) => <option key={m.id} value={m.id}>{m.number} · {m.title}</option>)}
            </select>
          </label>
          <span className="ml-auto flex items-center gap-2 text-[var(--color-muted)]">
            {pending && <span className="animate-alert">{t('conflicts.recording')}</span>}
            {!pending && current && (
              <>
                <Icon.check /> {t('conflicts.recorded', { who: current.performedBy, when: formatWhen(current.performedAt) })}
                <ConflictStatusSelect check={current} />
              </>
            )}
          </span>
        </div>

        <div className="scrollbar-thin max-h-[55vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <>
              <p className="px-3 pb-2 pt-1 text-sm text-[var(--color-muted)]">{t('conflicts.hint')}</p>
              <History checks={checks} derived={derived} onPick={(c) => setQuery(c.query)} />
            </>
          ) : hits.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm font-medium text-emerald-700"><Icon.check /> {t('conflicts.none')}</p>
          ) : (
            hits.map((h) => {
              const adverse = h.roles.some((r) => r.role === 'adverse' || r.role === 'avocat_adverse');
              return (
                <div key={h.party.id} className="rounded-xl p-3 hover:bg-white">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${adverse ? 'bg-[#8e4ec6]' : 'bg-blue-500'}`}>
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

/** Historique des vérifications, du plus récent au plus ancien. */
export function History({ checks, derived, onPick, limit = 25 }: { checks: ConflictCheck[]; derived: Derived; onPick?: (c: ConflictCheck) => void; limit?: number }) {
  const { t } = useTranslation();
  return (
    <section className="px-1">
      <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('conflicts.history')}</h3>
      {checks.length === 0 && <p className="px-2 text-xs text-[var(--color-muted)]">{t('conflicts.noHistory')}</p>}
      <ul className="space-y-0.5">
        {checks.slice(0, limit).map((c) => {
          const matter = c.matterId ? derived.snapshot.matters.find((m) => m.id === c.matterId) : undefined;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-xs hover:bg-white">
              <ConflictStatusSelect check={c} />
              <button type="button" disabled={!onPick} onClick={() => onPick?.(c)} className="min-w-[120px] flex-1 truncate text-left font-medium enabled:hover:underline">
                « {c.query} »
                {matter && <span className="font-normal text-[var(--color-muted)]"> → {matter.number}</span>}
              </button>
              <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                {t('conflicts.hits', { count: c.hits.length })} · {c.performedBy} · {formatWhen(c.performedAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
