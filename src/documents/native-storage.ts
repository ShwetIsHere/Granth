import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type DiscoveredFile = {
  uri: string;
  name: string;
  size: number;
  modifiedAt: number;
  volume: string;
  location: string;
};

export type PdfPage = {
  image: string;
  width: number;
  height: number;
  pageCount: number;
};

type NativeStorage = {
  isDiscoverySupported(): boolean;
  hasAccess(): boolean;
  requestAccess(): Promise<void>;
  scan(): Promise<DiscoveredFile[]>;
  prepareExternalPreview(uri: string): Promise<string>;
  renderPdfPage(uri: string, pageIndex: number): Promise<PdfPage>;
  takePdfOpenRequest?: () => Promise<{ uri: string; name: string; size?: number } | null>;
  renameFile?: (uri: string, name: string) => Promise<{ uri: string; name: string }>;
  addListener?: (event: 'onPdfOpen', listener: () => void) => { remove: () => void };
};

export const nativeStorage = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeStorage>('GranthStorage')
  : null;

