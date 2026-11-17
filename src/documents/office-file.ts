import { unzipSync } from 'fflate';

export const maxOfficeBytes = 32 * 1024 * 1024;

export function officeZip(bytes: Uint8Array, include: (name: string) => boolean = () => false) {
  let total = 0;
  let count = 0;
  return unzipSync(bytes, {
    filter: ({ name, originalSize }) => {
      total += originalSize;
      count += 1;
      if (count > 10000 || total > 128 * 1024 * 1024) {
        throw new Error('This file is too large to preview in GRANTH.');
      }
      return include(name);
    },
  });
}
