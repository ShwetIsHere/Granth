import { useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { fileSize, type SelectedFile } from '../documents/files';
import { useTheme } from '../theme/theme';
import { nativeStorage } from '../documents/native-storage';
import { renameLibraryFile } from '../state/library';
import { Action, IconButton, Screen } from './components';

function displayPath(uri: string) {
  if (!uri.startsWith('file://')) return uri;
  try { return decodeURIComponent(uri.slice(7)); } catch { return uri.slice(7); }
}

export function FileProperties({ file, onClose, onRemove, onRenamed }: {
  file: SelectedFile; onClose: () => void; onRemove?: () => void; onRenamed?: (file: SelectedFile) => void;
}) {
  const { colors } = useTheme();
  const [dimensions, setDimensions] = useState<string>();
  const dot = file.name.lastIndexOf('.');
  const extension = dot > 0 ? file.name.slice(dot) : '';
  const originalName = extension ? file.name.slice(0, -extension.length) : file.name;
  const [name, setName] = useState(originalName);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  async function saveName() {
    if (saving.current) return;
    const base = name.trim();
    if (!base || base === '.' || base === '..' || /[\\/\u0000-\u001f\u007f]/.test(base)) {
      setError('Enter a valid file name without slashes.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const renamed = await renameLibraryFile(file, base + extension);
      onRenamed?.(renamed);
      setEditing(false);
    } catch (failure) {
      setError(String(failure).includes('already exists')
        ? 'A file with that name already exists.'
        : 'Could not rename the original file. Check storage access and whether its provider allows renaming.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  let info: ReturnType<File['info']> | undefined;
  let mime = file.mimeType;
  try {
    const source = new File(file.id);
    info = source.info();
    mime ||= source.type;
  } catch { /* The indexed metadata is still usable. */ }

  useEffect(() => {
    if (file.category !== 'images') return;
    let active = true;
    Image.getSize(file.id).then(({ width, height }) => {
      if (active) setDimensions(`${width} × ${height} px`);
    }).catch(() => {});
    return () => { active = false; };
  }, [file.category, file.id]);

  const modified = info?.modificationTime || file.modifiedAt;
  const created = info?.creationTime;
  const rows: [string, string | undefined][] = [
    ['Name', file.name],
    ['Format', file.extension.toUpperCase() || 'Unknown'],
    ['MIME type', mime],
    ['Size', fileSize(info?.size ?? file.size)],
    ['Location', file.location],
    [file.id.startsWith('file:') ? 'Path' : 'Source URI', displayPath(file.id)],
    ['Modified', modified ? new Date(modified).toLocaleString() : undefined],
    ['Created', created ? new Date(created).toLocaleString() : undefined],
    ['Selected', !file.location ? new Date(file.selectedAt).toLocaleString() : undefined],
    ['Image dimensions', dimensions],
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!saving.current) onClose(); }}>
      <Screen>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text accessibilityRole="header" className="text-xl font-bold" style={{ color: colors.ink }}>File properties</Text>
          <IconButton icon="close-outline" label="Close properties" onPress={() => { if (!saving.current) onClose(); }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
          {nativeStorage?.renameFile && (editing ? (
            <View className="gap-2">
              <Text className="font-semibold" style={{ color: colors.ink }}>Rename file</Text>
              <View className="flex-row items-center rounded-xl border px-3" style={{ borderColor: colors.border }}>
                <TextInput accessibilityLabel="File name" autoFocus editable={!busy} value={name}
                  onChangeText={setName} selectTextOnFocus className="min-h-12 flex-1" style={{ color: colors.ink }} />
                {!!extension && <Text style={{ color: colors.muted }}>{extension}</Text>}
              </View>
              {!!error && <Text accessibilityLiveRegion="polite" style={{ color: colors.ink }}>{error}</Text>}
              <Action label={busy ? 'Saving…' : 'Save name'} icon="checkmark-outline" busy={busy} onPress={saveName} />
            </View>
          ) : <Action label="Rename" icon="create-outline" onPress={() => setEditing(true)} />)}
          {rows.map(([label, value]) => value ? (
            <View key={label} className="gap-1 border-b pb-3" style={{ borderColor: colors.border }}>
              <Text className="text-sm font-semibold" style={{ color: colors.muted }}>{label}</Text>
              <Text selectable className="text-base" style={{ color: colors.ink }}>{value}</Text>
            </View>
          ) : null)}
          {onRemove && <Action label="Remove from selection" icon="remove-circle-outline" onPress={onRemove} />}
        </ScrollView>
      </Screen>
    </Modal>
  );
}
