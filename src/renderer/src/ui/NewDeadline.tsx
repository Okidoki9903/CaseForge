/**
 * Ajout d'une échéance à un dossier : par règle du catalogue (calcul expliqué, date brute
 * retenue par prudence) ou par date précise.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeDeadline, findRule, rulesFor } from '@shared/domain/deadlineRules';
import { localToday } from '@shared/domain/dates';
import type { DeadlineKind, Matter } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { longDate } from '../lib/format';
import { inputClass } from './StaffForm';

export function NewDeadline({ matter, derived, onDone }: { matter: Matter; derived: Derived; onDone: () => void }) {
  const { t } = useTranslation();
  const addDeadline = useFirm((s) => s.addDeadline);
  const rules = rulesFor(matter.jurisdiction);
  const [mode, setMode] = useState<'rule' | 'manual'>(rules.length ? 'rule' : 'manual');
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? '');
  const [trigger, setTrigger] = useState(localToday());
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DeadlineKind>('procedure');
  const [due, setDue] = useState(localToday());
  const [assignedTo, setAssignedTo] = useState(matter.responsibleId);
  const rule = findRule(ruleId);
  let computed: ReturnType<typeof computeDeadline> | null = null;
  try {
    computed = mode === 'rule' && rule && /^\d{4}-\d{2}-\d{2}$/.test(trigger) ? computeDeadline(rule, trigger) : null;
  } catch {
    computed = null;
  }

  return (
    <form
      className="space-y-2 rounded-xl border border-[var(--color-brand)] bg-white p-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await addDeadline(
          mode === 'rule'
            ? { matterId: matter.id, assignedTo, ruleId, triggerDate: trigger, title: title || undefined }
            : { matterId: matter.id, assignedTo, title, kind, dueDate: due },
        );
        if (ok) onDone();
      }}
    >
      <div className="flex gap-1">
        {(['rule', 'manual'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={m === 'rule' && rules.length === 0}
            onClick={() => setMode(m)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-40 ${mode === m ? 'bg-[var(--color-ink)] text-white' : 'bg-slate-100 text-[var(--color-muted)]'}`}
          >
            {m === 'rule' ? t('newDeadline.byRule') : t('newDeadline.manual')}
          </button>
        ))}
      </div>
      {mode === 'rule' ? (
        <>
          <label className="block text-[11px] text-[var(--color-muted)]">
            {t('newDeadline.rule')}
            <select className={inputClass} value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
              {rules.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.amount} {r.unit} ({r.legalBasis})</option>)}
            </select>
          </label>
          <label className="block text-[11px] text-[var(--color-muted)]">
            {t('newDeadline.trigger')} {rule && <span>({rule.trigger})</span>}
            <input type="date" className={inputClass} value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </label>
          {computed && (
            <div className="rounded-lg bg-slate-50 p-2 text-[11px]">
              <div className="font-bold">{t('newDeadline.computed', { date: longDate(computed.rawDate) })}</div>
              <ul className="mt-0.5 list-disc pl-4 text-[var(--color-muted)]">
                {computed.reasoning.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[11px] text-[var(--color-muted)]">
            {t('newDeadline.title')}
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newDeadline.kind')}
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as DeadlineKind)}>
              {(['prescription', 'procedure', 'audience', 'interne'] as const).map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-[var(--color-muted)]">
            {t('newDeadline.due')}
            <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="flex-1 text-[11px] text-[var(--color-muted)]">
          {t('newDeadline.assigned')}
          <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            {derived.activeStaff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={onDone} className="h-8 rounded-md px-2 text-xs text-[var(--color-muted)] hover:bg-slate-100">{t('settings.cancel')}</button>
        <button type="submit" className="h-8 rounded-md bg-[var(--color-brand)] px-3 text-xs font-bold text-white">{t('newDeadline.add')}</button>
      </div>
    </form>
  );
}
