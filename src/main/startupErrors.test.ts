import { describe, expect, it } from 'vitest';
import { describeStartupError } from './startupErrors';

describe('erreurs de démarrage', () => {
  it('module natif compilé pour une autre version : message clair et correctif', () => {
    const e = describeStartupError(
      new Error("The module '/x/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 139."),
      '/tmp/caseforge.sqlite',
    );
    expect(e.nativeModule).toBe(true);
    expect(e.message).toContain('npm run rebuild:native');
  });

  it('base verrouillée, corrompue, inaccessible', () => {
    expect(describeStartupError(new Error('SQLITE_BUSY: database is locked'), 'p').title).toMatch(/occupée/);
    expect(describeStartupError(new Error('file is not a database'), 'p').message).toMatch(/sauvegardes/);
    expect(describeStartupError(new Error('SQLITE_CANTOPEN: unable to open'), 'p').message).toMatch(/CASEFORGE_DATA_DIR/);
    expect(describeStartupError('boom', 'p')).toMatchObject({ nativeModule: false, message: 'boom' });
  });
});
