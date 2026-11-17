import { useEffect } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { nativeStorage } from '../documents/native-storage';
import { viewerRoute } from '../documents/viewer-route';
import { useLibrary } from '../state/library';

export function PdfIntentHandler() {
  const router = useRouter();
  const navigationKey = useRootNavigationState()?.key;

  useEffect(() => {
    if (!navigationKey || !nativeStorage?.takePdfOpenRequest || !nativeStorage.addListener) return;
    const storage = nativeStorage;
    let active = true;
    let draining = false;
    let requested = false;

    async function receive() {
      requested = true;
      if (draining) return;
      draining = true;
      try {
        while (active && requested) {
          requested = false;
          const file = await storage.takePdfOpenRequest?.();
          if (!active || !file) continue;
          useLibrary.getState().add([{
            id: file.uri, name: file.name, size: file.size, selectedAt: Date.now(),
            extension: 'pdf', mimeType: 'application/pdf', category: 'pdf',
          }]);
          router.push(viewerRoute(file.uri));
        }
      } catch {
        // A subsequent Android open request can still be handled.
      } finally {
        draining = false;
      }
    }

    const subscription = nativeStorage.addListener('onPdfOpen', receive);
    void receive();
    return () => {
      active = false;
      subscription.remove();
    };
  }, [navigationKey, router]);

  return null;
}
