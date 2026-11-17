export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Android document intents are consumed through the native storage module.
  return /^(content|file):/i.test(path) ? null : path;
}
