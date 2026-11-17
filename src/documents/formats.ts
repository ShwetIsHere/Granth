export const categories = [
  { id: 'pdf', label: 'PDF', icon: 'document-text-outline', extensions: ['pdf'] },
  { id: 'word', label: 'Word', icon: 'reader-outline', extensions: ['docx', 'doc', 'rtf', 'odt'] },
  { id: 'sheets', label: 'Sheets', icon: 'grid-outline', extensions: ['xlsx', 'xls', 'csv', 'ods'] },
  { id: 'slides', label: 'Slides', icon: 'easel-outline', extensions: ['pptx', 'ppt', 'odp'] },
  { id: 'text', label: 'Text', icon: 'code-slash-outline', extensions: ['txt', 'md', 'log'] },
  { id: 'images', label: 'Images', icon: 'image-outline', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
] as const;

export type Category = (typeof categories)[number]['id'];

const mimeExtensions: Record<string, string | undefined> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'text/csv': 'csv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

export function findCategory(id?: string) {
  return categories.find(category => category.id === id);
}

export function detectFormat(name: string, mimeType?: string) {
  const dot = name.lastIndexOf('.');
  const suffix = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  const matches = (extension: string) =>
    categories.find(category => category.extensions.some(value => value === extension));
  const named = matches(suffix);
  const mime = mimeType && mimeExtensions[mimeType.split(';')[0].trim().toLowerCase()];
  const extension = named ? suffix : mime || suffix;
  return { extension, category: matches(extension)?.id };
}
