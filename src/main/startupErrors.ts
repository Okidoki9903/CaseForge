/**
 * Messages d'erreur de démarrage compréhensibles (pas de pile d'appels pour l'utilisateur).
 * Fonction pure, testable sans Electron.
 */

export interface StartupError {
  title: string;
  message: string;
  /** Erreur liée au module natif SQLite (compilé pour une autre version d'Electron/Node). */
  nativeModule: boolean;
}

export function describeStartupError(err: unknown, dbPath: string): StartupError {
  const raw = err instanceof Error ? err.message : String(err);
  if (/NODE_MODULE_VERSION|compiled against a different Node\.js version|Could not locate the bindings file|invalid ELF header|not a valid Win32 application|better_sqlite3\.node/i.test(raw)) {
    return {
      nativeModule: true,
      title: 'CaseForge — module SQLite à recompiler',
      message:
        'Le moteur de base de données local (better-sqlite3) a été compilé pour une autre version de Node.js ' +
        'que celle intégrée à Electron.\n\n' +
        'Pour corriger (une seule fois, dans le dossier du projet) :\n' +
        '    npm run rebuild:native\n\n' +
        'Les versions installées (.exe / .dmg / AppImage) incluent déjà le bon module.\n\n' +
        `Détail technique : ${raw.split('\n')[0]}`,
    };
  }
  if (/SQLITE_BUSY|database is locked/i.test(raw)) {
    return {
      nativeModule: false,
      title: 'CaseForge — base de données occupée',
      message: `La base locale est utilisée par un autre programme.\nFermez les autres instances de CaseForge puis relancez.\n\nFichier : ${dbPath}`,
    };
  }
  if (/SQLITE_CORRUPT|SQLITE_NOTADB|file is not a database|malformed/i.test(raw)) {
    return {
      nativeModule: false,
      title: 'CaseForge — base de données endommagée',
      message:
        `La base locale semble endommagée.\nVos sauvegardes quotidiennes se trouvent dans le dossier « sauvegardes » à côté du fichier :\n${dbPath}\n\n` +
        'Remplacez caseforge.sqlite par la sauvegarde la plus récente, puis relancez.',
    };
  }
  if (/SQLITE_CANTOPEN|EACCES|EPERM|read-only|SQLITE_READONLY/i.test(raw)) {
    return {
      nativeModule: false,
      title: 'CaseForge — accès au dossier de données refusé',
      message: `Impossible d'écrire la base locale :\n${dbPath}\n\nVérifiez les droits du dossier, ou définissez CASEFORGE_DATA_DIR vers un dossier accessible.`,
    };
  }
  return { nativeModule: false, title: 'CaseForge — erreur au démarrage', message: raw };
}
