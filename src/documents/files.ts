import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { detectFormat, type Category } from './formats';

export type SelectedFile = {
  id: string;
  name: string;
  size?: number;
  modifiedAt?: number;
  selectedAt: number;
  category?: Category;
  extension: string;
};

export async function pickFiles(): Promise<SelectedFile[] | null> {
  const result = await getDocumentAsync({ multiple: true, copyToCacheDirectory: false });
  if (result.canceled) return null;

  const selectedAt = Date.now();
  return result.assets.map(asset => {
    let size = asset.size;
    let modifiedAt: number | undefined;
    // Picker providers can supply metadata without a filesystem path.
    if (asset.uri.startsWith('file://')) {
      try {
        const info = new File(asset.uri).info();
        if (info.exists) {
          size ??= info.size;
          modifiedAt = info.modificationTime ?? undefined;
        }
      } catch {
        // Metadata from the system picker is still available.
      }
    }
    return {
      id: asset.uri,
      name: asset.name,
      size,
      modifiedAt,
      selectedAt,
      ...detectFormat(asset.name, asset.mimeType),
    };
  });
}

export function fileSize(size?: number) {
  if (size === undefined) return 'Size unavailable';
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
}
