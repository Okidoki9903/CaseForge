import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALERT_COLORS } from '@shared/domain/alerts';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { longDate } from '../lib/format';
import { Countdown, Icon } from './primitives';

/**
 * Bannière persistante : ne peut pas être fermée tant qu'une échéance critique ou dépassée
 * n'a pas fait l'objet d'un accusé de réception nominatif.
 */
export function AlertBanner({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const setAlertCenterOpen = useFirm((s) => s.setAlertCenterOpen);
  // Laisse la place au panneau de détail (gauche) et au centre d'alertes (droite).
  const panelOpen = useFirm((s) => s.selection !== null);
  const drawerOpen = useFirm((s) => s.alertCenterOpen || s.timeDrawerOpen);
  const pending = derived.alerts.filter((a) => a.requiresAcknowledgement);
  const [index, setIndex] = useState(0);

  // Fait défiler les alertes en attente.
  useEffect(() => {
    if (pending.length < 2) return;
    const id = setInterval(() => setIndex((i) => i + 1), 4500);
    return () => clearInterval(id);
  }, [pending.length]);

  if (pending.length === 0) return null;
  const a = pending[index % pending.length];
  const color = ALERT_COLORS[pending[0].level];

  return (
    <div className="absolute top-[86px] z-30" style={{ left: panelOpen ? 404 : 12, right: drawerOpen ? 484 : 12 }}>
      <div
        role="alert"
        className="pointer-events-auto mx-auto flex max-w-[860px] items-center gap-3 rounded-xl px-4 py-2.5 text-white shadow-xl"
        style={{ background: `linear-gradient(90deg, ${color}, ${ALERT_COLORS[a.level]})` }}
      >
        <span className="animate-alert"><Icon.alert /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide">{t('banner.title', { count: pending.length })}</div>
          <div key={a.deadline.id} className="animate-panel truncate text-sm">
            <b>{a.matter.number}</b> · {a.deadline.title} — {longDate(a.deadline.dueDate)} (<Countdown daysLeft={a.daysLeft} />)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAlertCenterOpen(true, 'critical')}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow active:scale-95"
          style={{ color }}
        >
          {t('banner.action')}
        </button>
      </div>
    </div>
  );
}
