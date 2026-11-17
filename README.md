# GRANTH

Every Document. One Granth.

GRANTH is an Android-first, offline document viewer project with an Expo foundation for iOS. The Android build discovers files in shared phone storage and mounted SD cards after the user grants Android's All files access on Android 11 or later. Android protects other apps' private files. The system picker is also available and keeps selected file metadata in memory for the current session.

## Run locally

Use Node.js 22.13 or later with npm. From the repository root:

```sh
npm ci
npm run typecheck
npx expo install --check
npm start
```

Expo Go SDK 58 supports the system picker and OS document handoff. Automatic storage discovery and in-app PDF rendering require the GRANTH Android development build.

For a local development build, install Android Studio and Android SDK Platform 37, set up USB debugging, and connect the phone. Stop any existing Metro server and run `npx expo run:android --device`. Open the installed GRANTH app. For subsequent sessions, run `npx expo start --dev-client`. An installed release with an embedded bundle can exercise the app without Metro or internet access.

## Physical Android smoke test

1. Launch GRANTH. Check the Home empty states and open Browse via both the main button and a format tile.
2. In the development build, choose **Allow storage access** in Browse and enable access in Android Settings. Return to GRANTH and verify files in Downloads and on a mounted SD card appear automatically. Revoke access and confirm discovered entries disappear.
3. Open a multi-page PDF from each storage volume. Check page navigation and zoom. Open a PPTX using **Open in another app** and verify it launches a compatible installed viewer. Also check the picker flow and cancel behavior.
4. In Appearance, try Light, Dark, and System. Force-stop and reopen the app to verify the setting is restored and the temporary selection is cleared.
5. With an installed release, disconnect from the network and repeat selection using files already downloaded to the device. Providers may require connectivity for remote-only files.

## Structure

```text
app/
  _layout.tsx        Navigation and appearance initialization
  index.tsx          Home
  browse.tsx         System picker and selection list
  appearance.tsx     Theme preferences
  viewer.tsx         In-app preview and OS viewer handoff
src/
  documents/        File selection, metadata, format detection, and search
  state/            In-memory selection store
  storage/          SQLite settings
  theme/            Theme state and color tokens
  ui/               Shared controls and document rows
modules/
  granth-storage/   Android storage discovery and PDF page rendering
```

## Dependencies

- Expo SDK 58, React 19.3, React Native 0.88, Expo Router, and Expo Dev Client. Constants, Linking, Screens, Safe Area Context, and React DOM satisfy Expo Router integration and peer requirements.
- NativeWind 4.2.7, Tailwind CSS 3.4, Reanimated 4.7, Worklets 0.13, Babel Preset Expo, and TypeScript 6.
- Zustand 5, Expo SQLite, Expo Document Picker, and Expo File System.
- Expo Vector Icons, Font, Status Bar, and System UI.

See `package-lock.json` for resolved versions. Bundling and dependency checks do not exercise Android permissions, picker callbacks, or SQLite on a phone.

## Rendering phases

Tapped PDFs render in the Android build with page navigation and zoom. Images preview in GRANTH. Office and other compatible files open through the OS viewer flow. Android may require a separate app that can open the format. To share a discovered raw file with that app, GRANTH stages a temporary private cache copy. Subsequent handoffs prune copies older than 24 hours. Android can also reclaim cache storage. Files discovered on a mounted volume are scanned again on launch, on return to the app, or on pull-to-refresh. Reading history and favorites remain future work.

- PDF. The Android build renders one page at a time with Android's PDF renderer. Text search, rotation, and password entry are pending. [Android PDF renderer](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer)
- Word. DOCX needs a renderer for styles, tables, images, and pagination. Evaluate distinct offline parsing or conversion for DOC, RTF, and ODT, including missing fonts and layout differences.
- Spreadsheets. Parse XLSX, XLS, CSV, and ODS using format-aware readers. Virtualize visible rows and columns and avoid loading large worksheets or recalculating an entire workbook on the UI thread.
- Slides. PPTX, PPT, and ODP require layout-aware parsing or offline conversion. Fonts, charts, media, and presentation effects may vary by engine.
- Images and text. Decode large images at a suitable display size and verify BMP support per platform. Read large text files incrementally and use a Markdown renderer for formatted previews.

See Expo's [SDK 58 release notes](https://expo.dev/changelog/sdk-58), [DocumentPicker documentation](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/), and the [NativeWind installation guide](https://www.nativewind.dev/docs/getting-started/installation).
