import type { SelectedFile } from './files';
import type { Category } from './formats';

export type SortOrder = 'recent' | 'name' | 'size';

const excludedSuffix = /(?:^|\.)(?:log(?:\.\d+)?|tmp|temp|crypt\d*|(?:db|sqlite3?)(?:-(?:wal|shm|journal))?|wal|shm|bak|cache|apk|apks|xapk|irc|opus|jpe?g|png|webp|bmp|gif|heic|heif|avif|tiff?|svg|ico|dng|jxl)$/i;

export function isListedFile(file: Pick<SelectedFile, 'name' | 'category' | 'location'>) {
  return file.category !== 'images'
    && !file.name.startsWith('~$')
    && !excludedSuffix.test(file.name)
    && ![...(file.location?.split(/[\\/]/) ?? []), file.name]
      .some(segment => segment.startsWith('.') && segment !== '..');
}

export function mergeFiles(discovered: SelectedFile[], picked: SelectedFile[]) {
  const byUri = new Map(discovered.map(file => [file.id, file]));
  for (const file of picked) {
    if (!byUri.has(file.id)) byUri.set(file.id, file);
  }
  return Array.from(byUri.values());
}

export function searchFiles(files: SelectedFile[], query: string, category?: Category, sort: SortOrder = 'recent') {
  const search = query.trim().toLowerCase();
  return files.filter(file =>
    (!category || file.category === category) && file.name.toLowerCase().includes(search) && isListedFile(file),
  ).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'size') return (b.size ?? -1) - (a.size ?? -1) || a.name.localeCompare(b.name);
    return b.selectedAt - a.selectedAt || a.name.localeCompare(b.name);
  });
}
