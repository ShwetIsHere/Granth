# GRANTH

Every Document. One Granth.

GRANTH is an Android-first, offline document viewer project with an Expo foundation for iOS. Phase 1 provides Home, Browse, and Appearance screens. The Android system picker grants access to user-selected documents through the Storage Access Framework. GRANTH displays available file metadata and keeps the selection in memory for the current session. Originals stay with their providers and GRANTH requests no broad storage permissions.

## Run locally

Use Node.js 22.13 or later with npm. From the repository root:

```sh
npm ci
npm run typecheck
npx expo install --check
npm start
```

Use the SDK 57 build of Expo Go on Android. If Google Play supplies a different SDK, get the matching Android build from [Expo Go](https://expo.dev/go?sdkVersion=57&platform=android&device=true). Connect the phone and computer to the same Wi-Fi network, then scan Metro's QR code with Expo Go. Use `npm run android` to launch on an already configured Android emulator.

A local development build is also possible with Android Studio, the Android SDK, and USB debugging. Install `expo-dev-client` with `npx expo install expo-dev-client`, then run `npx expo run:android --device`. Expo Go's development session needs a connection to Metro. An installed release with an embedded bundle can exercise the app without Metro or internet access.

## Physical Android smoke test

1. Launch GRANTH. Check the Home empty states and open Browse via both the main button and a format tile.
2. Select multiple files from Downloads, including one PDF and one differently formatted file. Check the names, format labels, and sizes where provided. Cancel a second picker session and confirm the list is preserved.
3. Filter by format, search by a filename fragment, change all three sort options, and remove a row. Return to Home and search for a remaining file. Check that originals are still present in Downloads.
4. In Appearance, try Light, Dark, and System. Force-stop and reopen the app to verify the setting is restored and the temporary selection is cleared.
5. With an installed release, disconnect from the network and repeat selection using files already downloaded to the device. Providers may require connectivity for remote-only files.

## Structure

```text
app/
  _layout.tsx        Navigation and appearance initialization
  index.tsx          Home
  browse.tsx         System picker and selection list
  appearance.tsx     Theme preferences
src/
  documents/        File selection, metadata, format detection, and search
  state/            In-memory selection store
  storage/          SQLite settings
  theme/            Theme state and color tokens
  ui/               Shared controls and document rows
```

## Dependencies

- Expo SDK 57, React 19.2, React Native 0.86, and Expo Router for navigation. Constants, Linking, Screens, Safe Area Context, and React DOM satisfy Expo Router integration and peer requirements.
- NativeWind 4.2.7, Tailwind CSS 3.4, Reanimated 4.5, Worklets 0.10, Babel Preset Expo, and TypeScript 6.
- Zustand 5, Expo SQLite, Expo Document Picker, and Expo File System.
- Expo Vector Icons, Font, Status Bar, and System UI.

See `package-lock.json` for resolved versions. The Phase 1 native modules are covered by the matching Android Expo Go build. Bundling and dependency checks do not exercise native picker callbacks or SQLite on a phone.

## Rendering phases

The Browse list represents selected metadata. Reading history and favorites start empty, and opening, rendering, and persistent reopen permissions belong to later phases. When Phase 2 adds reopening, verify persistable Android URI grants and use app-owned copies only where a provider or renderer requires them.

- PDF. Trial an offline native renderer with page navigation, zoom, and password-protected samples. Treat text search as a separate compatibility check, including on older Android versions. React Native PDF and its file-access dependency would require a development build. Keep decoded page memory bounded. [Library documentation](https://github.com/wonday/react-native-pdf/blob/master/README.md) · [Android PDF renderer](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer)
- Word. DOCX needs a renderer for styles, tables, images, and pagination. Evaluate distinct offline parsing or conversion for DOC, RTF, and ODT, including missing fonts and layout differences.
- Spreadsheets. Parse XLSX, XLS, CSV, and ODS using format-aware readers. Virtualize visible rows and columns and avoid loading large worksheets or recalculating an entire workbook on the UI thread.
- Slides. PPTX, PPT, and ODP require layout-aware parsing or offline conversion. Fonts, charts, media, and presentation effects may vary by engine.
- Images and text. Decode large images at a suitable display size and verify BMP support per platform. Read large text files incrementally and use a Markdown renderer for formatted previews.

See Expo's [SDK 57 release notes](https://expo.dev/changelog/sdk-57), [DocumentPicker documentation](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), and the [NativeWind installation guide](https://www.nativewind.dev/docs/getting-started/installation).
