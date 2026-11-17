import { create } from 'zustand';
import type { SelectedFile } from '../documents/files';

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
