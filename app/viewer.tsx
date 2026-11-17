import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { nativeStorage } from '../src/documents/native-storage';
import { useDiscovery, useLibrary } from '../src/state/library';
import { useTheme } from '../src/theme/theme';
import { Action, EmptyCard, IconButton, Screen, ScreenHeading } from '../src/ui/components';
import { PdfViewer } from '../src/ui/pdf-viewer';
import { OfficeViewer } from '../src/ui/office-viewer';
import { ImageViewer } from '../src/ui/image-viewer';
import { FileProperties } from '../src/ui/file-properties';
import { viewerRoute } from '../src/documents/viewer-route';

export default function Viewer() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const file = useLibrary(state => state.files.find(entry => entry.id === id));
  const discovered = useDiscovery(state => state.files.find(entry => entry.id === id));
  const document = discovered ?? file;
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showProperties, setShowProperties] = useState(false);
  const opening = useRef(false);
  const showPdf = document?.category === 'pdf' && nativeStorage !== null;
  const showImage = document?.category === 'images';
  const showOffice = document && ['xlsx', 'xls', 'csv', 'ods', 'pptx', 'docx'].includes(document.extension);

  async function openExternally() {
    if (!document || opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    let temporary: File | undefined;
    try {
      if (document.location && nativeStorage) {
        temporary = new File(await nativeStorage.prepareExternalPreview(document.id));
      }
      await (temporary ?? new File(document.id)).preview({ title: document.name, mimeType: document.mimeType });
    } catch {
      if (temporary) {
        try { temporary.delete(); } catch { /* Expired cache is cleaned before subsequent previews. */ }
      }
      setError('The file may have moved or been removed, or there may be no compatible viewer installed.');
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeading title={document?.name ?? 'Document'} onBack={() => router.canGoBack() ? router.back() : router.replace('/browse')} />
      {!document ? (
        <View className="px-4">
          <EmptyCard icon="document-outline" title="File unavailable" description="Return to Browse and select the file again." />
        </View>
      ) : (
        <>
          {showPdf && <PdfViewer key={document.id} uri={document.id} />}
          {showOffice && <OfficeViewer key={document.id} file={document} />}
          {showImage && <ImageViewer key={document.id} uri={document.id} name={document.name} />}
          <View className="gap-3 px-4 pb-4">
            {!showPdf && !showImage && !showOffice && (
              <Text className="text-base" style={{ color: colors.muted }}>
                {Platform.OS === 'android' ? 'This file opens in a compatible app installed on your device.' : 'Use the system viewer to preview this file.'}
              </Text>
            )}
            {error !== '' && <EmptyCard icon="alert-circle-outline" title="Could not open file" description={error} />}
            <View className="flex-row flex-wrap items-center gap-2">
              <Action label={busy ? 'Opening…' : Platform.OS === 'android' ? 'Open in another app' : 'Open system preview'}
                icon="open-outline" onPress={openExternally} busy={busy} />
              <IconButton icon="information-circle-outline" label="File properties" onPress={() => setShowProperties(true)} />
            </View>
          </View>
          {showProperties && <FileProperties file={document} onClose={() => setShowProperties(false)}
            onRenamed={file => { setShowProperties(false); router.replace(viewerRoute(file.id)); }} />}
        </>
      )}
    </Screen>
  );
}
