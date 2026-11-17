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
3. In Browse, check the first 10 results and tap **Load More** to append the next batch without changing scroll position. Tap a tile's info icon to view its properties or rename the original. Reopen the app and verify the new name. Open a workbook, pinch to zoom, and drag column and row header borders to resize. Reopen the workbook and check that its layout is restored. Open a large CSV, scroll down, and scroll back up to check that rows reload correctly.
4. From Android's file manager or a messaging app, open a PDF with **GRANTH**. Test once while GRANTH is already running and once from a cold launch.
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

PDFs, spreadsheets, DOCX, and PPTX files have in-app previews. Browse and Home search append 10 results when you tap **Load More**. Browse shows thumbnails where a preview is available and a format icon otherwise. Automatic discovery excludes images, hidden paths, common temporary and database files, Android packages, IRC files, and Opus audio. Photos explicitly selected through the system picker can still open from their original URI. File properties can rename the original file on writable shared storage or through a provider that supports renaming. Additional formats can open through the OS viewer. To share a discovered raw file with another app, GRANTH stages a temporary private cache copy and prunes copies older than 24 hours during subsequent handoffs.

- PDF. The Android build registers GRANTH for `application/pdf` in Android's **Open with** chooser. Rebuild the APK when adding this integration to an existing development install. Scroll vertically between pages, pinch to zoom, and drag to pan the zoomed page. Reset zoom to resume scrolling. Text search, rotation, and password entry are pending. [Android PDF renderer](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer)
- Word. DOCX uses the document's section page sizes, margins, paragraph spacing, indents, headers, footers, and saved page breaks. Overflow pagination is estimated when the document supplies no saved breaks. Complex layouts can differ from Word. DOC, RTF, and ODT still open with the OS viewer.
- Spreadsheets. CSV files are read in chunks and decoded for the visible rows plus a 10-row buffer on either side. XLSX, XLS, and ODS parse the selected worksheet using SheetJS, with up to 10,000 rows per sheet and a 32 MB file limit. The grid virtualizes row views and shows up to 20 columns per window. Pinch zoom and dimensions adjusted by dragging header borders are saved per worksheet. [SheetJS Community Edition](https://docs.sheetjs.com/docs/solutions/input/)
- Slides. The offline PPTX preview stacks slides vertically with pinch-to-zoom. It supports positioned text, simple fills, and embedded bitmap images. Advanced layouts, charts, and effects may differ. Legacy PPT and ODP still open with the OS viewer.
- Images and text. Decode large images at a suitable display size and verify BMP support per platform. Read large text files incrementally and use a Markdown renderer for formatted previews.

See Expo's [SDK 58 release notes](https://expo.dev/changelog/sdk-58), [DocumentPicker documentation](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/), and the [NativeWind installation guide](https://www.nativewind.dev/docs/getting-started/installation).
