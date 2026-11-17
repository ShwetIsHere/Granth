import { strFromU8 } from 'fflate';

const chunkSize = 64 * 1024;
const maxRowBytes = 2 * 1024 * 1024;
export const csvBuffer = 10;
type ReadAt = (offset: number, length: number) => Promise<Uint8Array>;

function separator(text: string) {
  const counts = [0, 0, 0];
  const choices = [',', ';', '\t'];
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (!quoted) {
      const index = choices.indexOf(char);
      if (index >= 0) counts[index]++;
    }
  }
  return choices[counts.indexOf(Math.max(...counts))];
}

function cells(text: string, delimiter: string) {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && (quoted || !value)) {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(value);
      value = '';
    } else value += char;
  }
  result.push(value);
  return result;
}

export function createCsvWindow(readAt: ReadAt) {
  const offsets = [0];
  let position = 0;
  let quoted = false;
  let afterCR = false;
  let done = false;
  let utf16: 'little' | 'big' | undefined;
  let delimiter: string | undefined;
  let columns = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function indexRows(required: number) {
    while (!done && offsets.length - 1 < required) {
      const bytes = await readAt(position, chunkSize);
      if (!bytes.length) {
        if (offsets.at(-1) !== position) offsets.push(position);
        done = true;
        break;
      }
      if (position === 0) {
        if (bytes[0] === 255 && bytes[1] === 254) utf16 = 'little';
        if (bytes[0] === 254 && bytes[1] === 255) utf16 = 'big';
      }
      const unit = utf16 ? 2 : 1;
      for (let index = 0; index < bytes.length; index += unit) {
        const code = utf16 === 'little' ? bytes[index] + 256 * bytes[index + 1]
          : utf16 === 'big' ? 256 * bytes[index] + bytes[index + 1] : bytes[index];
        position += Math.min(unit, bytes.length - index);
        if (afterCR && code === 10) offsets[offsets.length - 1] = position;
        else if (code === 34) quoted = !quoted;
        else if (!quoted && (code === 10 || code === 13)) offsets.push(position);
        afterCR = !quoted && code === 13;
      }
    }
  }

  function decode(bytes: Uint8Array) {
    if (!utf16) return strFromU8(bytes);
    const segments: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      const end = Math.min(bytes.length - 1, offset + 8191);
      const units: number[] = [];
      for (let at = offset; at < end; at += 2) {
        units.push(utf16 === 'little' ? bytes[at] + 256 * bytes[at + 1] : 256 * bytes[at] + bytes[at + 1]);
      }
      segments.push(String.fromCharCode(...units));
    }
    return segments.join('');
  }

  async function load(first: number, last: number) {
    await indexRows(last + 1);
    const rows = new Map<number, string[]>();
    let batch = new Uint8Array();
    let batchStart = -1;
    for (let index = first; index <= Math.min(last, offsets.length - 2); index++) {
      const start = offsets[index];
      const length = offsets[index + 1] - start;
      if (length > maxRowBytes) throw new Error('This CSV contains a row too large to preview.');
      if (start < batchStart || start + length > batchStart + batch.length) {
        batchStart = start;
        batch = new Uint8Array(await readAt(start, Math.max(length, chunkSize)));
      }
      const text = decode(batch.subarray(start - batchStart, start - batchStart + length))
        .replace(/^\uFEFF/, '').replace(/\r?\n$|\r$/, '');
      if (!delimiter && text) delimiter = separator(text);
      const row = cells(text, delimiter ?? ',');
      columns = Math.max(columns, row.length);
      rows.set(index + 1, row);
    }
    return { rows, count: offsets.length - 1, columns, done };
  }

  return {
    window(first: number, last: number) {
      const job = queue.then(() => load(first, last));
      queue = job.catch(() => {});
      return job;
    },
  };
}

export type CsvWindow = ReturnType<typeof createCsvWindow>;
export type CsvRows = Awaited<ReturnType<CsvWindow['window']>>;
