import { createContext } from 'react';
import type { Vector3 } from 'three';
import type { Activity } from './staffNavigation';
export interface StaffMotion { areaId: string; position: Vector3; activity: Activity }
// Frame-local traffic never writes to the business database.
export const StaffTraffic = createContext(new Map<string, StaffMotion>());
