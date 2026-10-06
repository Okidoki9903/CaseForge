import type { CampusLayout, Vec3 } from './layout';
export type Activity = 'working' | 'walking' | 'collecting';
export interface RouteStop { position: Vec3; wait: number; activity: Activity; facing?: number }
export const WORK_SEATS: Vec3[] = [[-1, 0.3, 0.55], [1, 0.3, 0.55], [1.5, 0.3, 1.25]];

/** Door > side access > front aisle. No diagonals through buildings or pipelines. */
export function buildStaffRoute(layout: CampusLayout, areaId: string, seat: number, assignments: { areaId: string; position: Vec3 }[], seed: number): RouteStop[] {
  const area = layout.areas.get(areaId);
  if (!area) return [];
  const [x, , z] = area.center;
  const local = WORK_SEATS[seat % WORK_SEATS.length];
  const home: Vec3 = [x + local[0], 0.3, z + local[2]];
  const work: RouteStop = { position: home, wait: 14 + seed % 15, activity: 'working', facing: Math.PI };
  if (!assignments.length) return [work];
  const walk = (position: Vec3): RouteStop => ({ position, wait: 0, activity: 'walking' });
  const access = (id: string): Vec3[] => {
    const [ax, , az] = layout.areas.get(id)!.center;
    const front = Math.max(az + 6.5, ...[...layout.matters.values()].filter(p => Math.abs(p[0] - ax) < 5 && p[2] > az && p[2] < az + 10).map(p => p[2] + 1));
    return [[ax, 0.3, az + 1.25], [ax, 0.3, az + 2.1], [ax, 0.25, az + 2.75], [ax + 5.1, 0.25, az + 2.75], [ax + 5.1, 0.25, front]];
  };
  const roadZ = Math.max(...[...layout.areas.values()].map(a => a.center[2])) + 10;
  const result: RouteStop[] = [work];
  for (const task of assignments) {
    if (!layout.areas.has(task.areaId)) continue;
    const out = access(areaId);
    result.push(walk([x, 0.3, home[2]]), ...out.map(walk));
    let destination = out[out.length - 1];
    const cross: Vec3[] = [];
    if (task.areaId !== areaId) {
      const other = access(task.areaId);
      destination = other[other.length - 1];
      cross.push([out[out.length - 1][0], 0.25, roadZ], [destination[0], 0.25, roadZ], destination);
      result.push(...cross.map(walk));
    }
    const aisle: Vec3 = [destination[0], 0.25, task.position[2] + 0.7];
    const pickup: Vec3 = [task.position[0], 0.25, task.position[2] + 0.7];
    result.push(walk(aisle), { position: pickup, wait: 4 + seed % 4, activity: 'collecting', facing: Math.PI }, walk(aisle), walk(destination));
    result.push(...cross.slice(0, -1).reverse().map(walk), ...out.slice().reverse().map(walk), walk([x, 0.3, home[2]]), work);
  }
  return result;
}
