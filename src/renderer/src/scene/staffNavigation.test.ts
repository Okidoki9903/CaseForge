import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '@shared/seed';
import { computeLayout } from './layout';
import { buildStaffRoute } from './staffNavigation';

const snapshot = buildDemoSnapshot('2026-10-06');
const layout = computeLayout(snapshot);
const first = snapshot.practiceAreas[0].id;

describe('staff routes', () => {
  it('keeps a person without assignments working inside their own building', () => {
    const route = buildStaffRoute(layout, first, 0, [], 15);
    expect(route).toHaveLength(1);
    expect(route[0].activity).toBe('working');
    expect(route[0].wait).toBeGreaterThan(10);
  });
  it('visits only assigned files and returns to the office through the entrance', () => {
    for (const p of snapshot.staff) {
      const tasks = snapshot.matters.filter(m => m.status === 'actif' && (m.responsibleId === p.id || m.teamIds.includes(p.id))).map(m => ({ areaId: m.practiceAreaId, position: layout.matters.get(m.id)! }));
      const route = buildStaffRoute(layout, p.practiceAreaId, 0, tasks, 12);
      expect(route.filter(s => s.activity === 'collecting')).toHaveLength(tasks.length);
      expect(route[route.length - 1].position).toEqual(route[0].position);
      // Horizontal ground-plane segments: no diagonal shortcut through a wall.
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1].position, b = route[i].position;
        expect(a[0] === b[0] || a[2] === b[2]).toBe(true);
        for (const [mx, , mz] of layout.matters.values()) {
          const crossesFile = a[0] === b[0]
            ? Math.abs(a[0] - mx) < 0.69 && Math.max(a[2], b[2]) > mz - 0.66 && Math.min(a[2], b[2]) < mz + 0.66
            : Math.abs(a[2] - mz) < 0.66 && Math.max(a[0], b[0]) > mx - 0.69 && Math.min(a[0], b[0]) < mx + 0.69;
          expect(crossesFile, `${p.id} crosses a file`).toBe(false);
        }
        // Every segment outside the home building avoids every other building footprint.
        for (const [id, area] of layout.areas) {
          if (id === p.practiceAreaId) continue;
          const [x, , z] = area.center;
          const crosses = a[0] === b[0]
            ? Math.abs(a[0] - x) < 2.35 && Math.max(a[2], b[2]) > z - 2.35 && Math.min(a[2], b[2]) < z + 2.35
            : Math.abs(a[2] - z) < 2.35 && Math.max(a[0], b[0]) > x - 2.35 && Math.min(a[0], b[0]) < x + 2.35;
          expect(crosses, `${p.id} crosses ${id}`).toBe(false);
        }
      }
    }
  });
  it('does not send staff wandering when a building is missing', () => {
    expect(buildStaffRoute(layout, 'missing', 0, [], 1)).toEqual([]);
  });
});
