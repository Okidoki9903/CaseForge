import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CampusScene } from './scene/CampusScene';
import { useDerived } from './store/useDerived';
import { useFirm } from './store/useFirm';
import { AlertBanner } from './ui/AlertBanner';
import { AlertCenter } from './ui/AlertCenter';
import { ConflictSearch } from './ui/ConflictSearch';
import { DetailPanel } from './ui/DetailPanel';
import { Legend } from './ui/Legend';
import { PipelineBar } from './ui/PipelineBar';
import { TimeDrawer } from './ui/TimeDrawer';
import { Onboarding } from './ui/Onboarding';
import { Settings } from './ui/Settings';
import { EmptyFirmHint, NewMatter } from './ui/NewMatter';
import { TopBar } from './ui/TopBar';

const REFRESH_MS = 60_000;

export function App() {
  const { t } = useTranslation();
  const load = useFirm((s) => s.load);
  const error = useFirm((s) => s.error);
  const clearError = useFirm((s) => s.clearError);
  const derived = useDerived();

  // Les messages d'erreur disparaissent d'eux-mêmes après quelques secondes.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 5000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  // Chargement initial + rafraîchissement périodique (changement de jour, notifications).
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!derived) {
    return <div className="grid h-full place-items-center text-sm text-[var(--color-muted)]">{error ?? t('app.loading')}</div>;
  }

  return (
    <main className="relative h-full w-full select-none">
      <div className="absolute inset-0">
        <CampusScene derived={derived} />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <TopBar derived={derived} />
        <AlertBanner derived={derived} />
        <DetailPanel derived={derived} />
        <PipelineBar derived={derived} />
        <Legend />
        <AlertCenter derived={derived} />
        <TimeDrawer derived={derived} />
        <ConflictSearch derived={derived} />
        <EmptyFirmHint derived={derived} />
        <NewMatter derived={derived} />
        <Settings derived={derived} />
        <Onboarding derived={derived} />
        {error && (
          <div role="status" className="pointer-events-auto absolute bottom-24 right-3 z-50 rounded-lg bg-[var(--color-critique)] px-3 py-2 text-sm text-white shadow-lg">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
