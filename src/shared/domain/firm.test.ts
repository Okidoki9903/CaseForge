import { describe, expect, it } from 'vitest';
import { emptyFirmSnapshot, normalizeSettingsPatch, normalizeStaffInput } from './firm';
import type { Staff, StaffInput } from '../types';

const areas = ['pa-lit'];
const base: StaffInput = { name: 'Me Anne Roy', initials: 'ar', role: 'avocat', practiceAreaId: 'pa-lit', hourlyRateCents: 30000, targetHoursWeek: 32 };

describe('paramètres du cabinet', () => {
  it('valide les paramètres', () => {
    expect(normalizeSettingsPatch({ firmName: '  Roy  Avocats ' })).toEqual({ firmName: 'Roy Avocats' });
    expect(normalizeSettingsPatch({ jurisdictions: ['ON', 'QC', 'XX' as never] }).jurisdictions).toEqual(['QC', 'ON']);
    expect(() => normalizeSettingsPatch({ jurisdictions: [] })).toThrow();
    expect(() => normalizeSettingsPatch({ firmName: 'x' })).toThrow();
    expect(() => normalizeSettingsPatch({ defaultRateCents: -1 })).toThrow();
    expect(() => normalizeSettingsPatch({ defaultRateCents: 600_000 })).toThrow();
  });

  it('valide un collaborateur et impose des initiales uniques', () => {
    const s = normalizeStaffInput(base, [], areas);
    expect(s).toMatchObject({ initials: 'AR', costRateCents: 11400, targetHoursWeek: 32 });
    const existing = [{ id: 'x', initials: 'AR' } as Staff];
    expect(() => normalizeStaffInput(base, existing, areas)).toThrow(/déjà utilisées/);
    expect(() => normalizeStaffInput({ ...base, id: 'x' }, existing, areas)).not.toThrow();
    expect(() => normalizeStaffInput({ ...base, practiceAreaId: 'zz' }, [], areas)).toThrow();
    expect(() => normalizeStaffInput({ ...base, hourlyRateCents: Number.NaN }, [], areas)).toThrow();
    expect(() => normalizeStaffInput({ ...base, targetHoursWeek: 0 }, [], areas)).toThrow();
    expect(() => normalizeStaffInput({ ...base, role: 'juge' as never }, [], areas)).toThrow();
  });

  it('crée un cabinet vide sans donnée fictive', () => {
    const s = emptyFirmSnapshot({ firmName: 'Roy Avocats', jurisdictions: ['QC'], defaultRateCents: 30000, owner: base });
    expect(s.settings).toEqual({ firmName: 'Roy Avocats', jurisdictions: ['QC'], defaultRateCents: 30000, onboarded: true, demo: false });
    expect(s.staff).toHaveLength(1);
    expect(s.matters).toHaveLength(0);
    expect(s.practiceAreas.length).toBeGreaterThan(0);
  });
});
