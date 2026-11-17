import type { SelectedFile } from './files';
import type { Category } from './formats';

export type SortOrder = 'recent' | 'name' | 'size';

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
    (!category || file.category === category) && file.name.toLowerCase().includes(search),
  ).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'size') return (b.size ?? -1) - (a.size ?? -1) || a.name.localeCompare(b.name);
    return b.selectedAt - a.selectedAt || a.name.localeCompare(b.name);
  });
}
