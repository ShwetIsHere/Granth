import { create } from 'zustand';
import type { SelectedFile } from '../documents/files';
import { detectFormat } from '../documents/formats';
import { nativeStorage } from '../documents/native-storage';
import { isListedFile } from '../documents/search';
import { moveWorkbookLayout } from '../storage/settings';

type Library = {
  files: SelectedFile[];
  add: (files: SelectedFile[]) => void;
  remove: (id: string) => void;
};

export const useLibrary = create<Library>(set => ({
  files: [],
  add: files => set(state => {
    const entries = new Map(state.files.map(file => [file.id, file]));
    for (const file of files) entries.set(file.id, file);
    return { files: Array.from(entries.values()) };
  }),
  remove: id => set(state => ({ files: state.files.filter(file => file.id !== id) })),
}));

type Discovery = {
  files: SelectedFile[];
  status: 'unavailable' | 'permission' | 'loading' | 'ready' | 'error';
  refresh: () => Promise<void>;
};

export const useDiscovery = create<Discovery>((set, get) => ({
  files: [],
  status: nativeStorage?.isDiscoverySupported() ? 'permission' : 'unavailable',
  refresh: async () => {
    if (!nativeStorage?.isDiscoverySupported()) return;
    if (!nativeStorage.hasAccess()) {
      set({ status: 'permission', files: [] });
      return;
    }
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const entries = await nativeStorage.scan();
      if (!nativeStorage.hasAccess()) {
        set({ status: 'permission', files: [] });
        return;
      }
      set({
        status: 'ready',
        files: entries.filter(isListedFile).map(entry => ({
          id: entry.uri,
          name: entry.name,
          size: entry.size,
          modifiedAt: entry.modifiedAt || undefined,
          selectedAt: entry.modifiedAt,
          location: entry.location === '/' ? entry.volume : entry.volume + '/' + entry.location,
          ...detectFormat(entry.name),
        })),
      });
    } catch {
      set(nativeStorage.hasAccess() ? { status: 'error' } : { status: 'permission', files: [] });
    }
  },
}));

export async function renameLibraryFile(file: SelectedFile, name: string) {
  if (!nativeStorage?.renameFile) throw new Error('Install the updated GRANTH Android build to rename files.');
  const result = await nativeStorage.renameFile(file.id, name);
  const renamed: SelectedFile = { ...file, id: result.uri, name: result.name, ...detectFormat(result.name, file.mimeType) };
  function replace(files: SelectedFile[]) {
    return files.some(entry => entry.id === file.id)
      ? files.filter(entry => entry.id !== renamed.id || entry.id === file.id)
        .map(entry => entry.id === file.id ? renamed : entry)
      : files;
  }
  useLibrary.setState(state => ({ files: replace(state.files) }));
  useDiscovery.setState(state => ({ files: replace(state.files) }));
  if (file.category === 'sheets') {
    try { await moveWorkbookLayout(file.id, renamed.id); } catch { /* The original was already renamed. */ }
  }
  return renamed;
}
