import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type ThemePreference = 'system' | 'light' | 'dark';

let connection: Promise<SQLiteDatabase> | undefined;

async function openSettings() {
  const db = await openDatabaseAsync('granth.db');
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

function settingsDatabase() {
  connection ??= openSettings().catch(error => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function readTheme(): Promise<ThemePreference> {
  const db = await settingsDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', 'theme',
  );
  return row?.value === 'light' || row?.value === 'dark' ? row.value : 'system';
}

export async function saveTheme(preference: ThemePreference) {
  const db = await settingsDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'theme', preference,
  );
}

export type SheetLayout = { zoom: number; columns: Record<string, number>; rows: Record<string, number> };
export type WorkbookLayout = Record<string, SheetLayout>;

const workbookKey = (uri: string) => 'workbook:' + uri;

export async function readWorkbookLayout(uri: string): Promise<WorkbookLayout> {
  const db = await settingsDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', workbookKey(uri),
  );
  return row ? JSON.parse(row.value) as WorkbookLayout : {};
}

export async function saveWorkbookLayout(uri: string, layout: WorkbookLayout) {
  const db = await settingsDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    workbookKey(uri), JSON.stringify(layout),
  );
}

export async function moveWorkbookLayout(previousUri: string, newUri: string) {
  if (previousUri === newUri) return;
  const db = await settingsDatabase();
  await db.runAsync('UPDATE OR REPLACE settings SET key = ? WHERE key = ?', workbookKey(newUri), workbookKey(previousUri));
}
