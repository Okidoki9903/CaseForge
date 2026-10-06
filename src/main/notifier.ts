/**
 * Notifications système (locales, via le système d'exploitation) pour les échéances
 * critiques ou dépassées non accusées. Une notification par échéance et par jour.
 */
import { Notification, type BrowserWindow } from 'electron';
import { buildAlerts } from '@shared/domain/alerts';
import { localToday } from '@shared/domain/dates';
import type { Repository } from './db/repository';
import { e2eLog } from './e2eLog';

const CHECK_EVERY_MS = 15 * 60 * 1000;

export class DeadlineNotifier {
  private notified = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly repo: Repository, private readonly getWindow: () => BrowserWindow | null) {}

  start(): void {
    this.check();
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  check(): void {
    const supported = Notification.isSupported();
    const today = localToday();
    const s = this.repo.getSnapshot();
    const pending = buildAlerts(s.deadlines, s.matters, today).filter((a) => a.requiresAcknowledgement);
    for (const a of pending) {
      const key = `${today}:${a.deadline.id}`;
      if (this.notified.has(key)) continue;
      this.notified.add(key);
      const overdue = a.level === 'depasse';
      const title = overdue ? `⛔ Échéance DÉPASSÉE — ${a.matter.number}` : `⚠️ Échéance critique — ${a.matter.number}`;
      const body = `${a.deadline.title} · ${a.deadline.dueDate}\n${a.matter.title}`;
      // Trace locale pour les tests de bout en bout (inactive en utilisation normale).
      e2eLog(`[notification] ${title} | ${a.deadline.title}`);
      if (!supported) continue;
      const n = new Notification({ title, body, urgency: 'critical' });
      n.on('click', () => {
        const win = this.getWindow();
        if (!win) return;
        if (win.isMinimized()) win.restore();
        win.focus();
      });
      n.show();
    }
  }
}
