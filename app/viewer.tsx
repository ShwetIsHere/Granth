import { useRef, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { nativeStorage } from '../src/documents/native-storage';
import { useDiscovery, useLibrary } from '../src/state/library';
import { useTheme } from '../src/theme/theme';
import { Action, EmptyCard, Screen, ScreenHeading } from '../src/ui/components';
import { PdfViewer } from '../src/ui/pdf-viewer';

export default function Viewer() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const file = useLibrary(state => state.files.find(entry => entry.id === id));
  const discovered = useDiscovery(state => state.files.find(entry => entry.id === id));
  const document = discovered ?? file;
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const [imageFailed, setImageFailed] = useState(false);
  const showPdf = document?.category === 'pdf' && nativeStorage !== null;
  const showImage = document?.category === 'images' && !imageFailed;

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
          {showImage && <Image className="mx-4 flex-1" accessibilityLabel={document.name} source={{ uri: document.id }}
            resizeMode="contain" onError={() => setImageFailed(true)} />}
          <View className="gap-3 px-4 pb-4">
            {!showPdf && !showImage && (
              <Text className="text-base" style={{ color: colors.muted }}>
                {Platform.OS === 'android' ? 'This file opens in a compatible app installed on your device.' : 'Use the system viewer to preview this file.'}
              </Text>
            )}
            {error !== '' && <EmptyCard icon="alert-circle-outline" title="Could not open file" description={error} />}
            <Action label={busy ? 'Opening…' : Platform.OS === 'android' ? 'Open in another app' : 'Open system preview'}
              icon="open-outline" onPress={openExternally} busy={busy} />
          </View>
        </>
      )}
    </Screen>
  );
}
