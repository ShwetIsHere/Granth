import { File, FileMode } from 'expo-file-system';
import { createCsvWindow } from './csv-window';

export function openCsv(uri: string) {
  const file = new File(uri);
  return createCsvWindow(async (offset, length) => {
    const handle = file.open(FileMode.ReadOnly);
    try {
      handle.offset = offset;
      const first = await handle.readBytes(length);
      if (first.length === length || first.length === 0) return first;
      const bytes = new Uint8Array(length);
      bytes.set(first);
      let filled = first.length;
      while (filled < length) {
        const chunk = await handle.readBytes(length - filled);
        if (!chunk.length) break;
        bytes.set(chunk, filled);
        filled += chunk.length;
      }
      return bytes.subarray(0, filled);
    } finally {
      handle.close();
    }
  });
}
