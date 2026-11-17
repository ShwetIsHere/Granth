export function viewerRoute(uri: string) {
  // Expo Router decodes the query parameter again in useLocalSearchParams.
  // Preserve the URI's original escapes for the library lookup and native viewer.
  return { pathname: '/viewer' as const, params: { id: encodeURIComponent(uri) } };
}
