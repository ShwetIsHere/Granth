import { read, type WorkSheet } from 'xlsx';
import { officeZip } from './office-file';

export const maxWorksheetRows = 10000;

export function readWorkbook(bytes: Uint8Array, options: { sheetRows?: number; sheets?: number } = {}) {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) officeZip(bytes);
  return read(bytes, { type: 'array', sheetRows: maxWorksheetRows, cellStyles: true, cellFormula: false, cellHTML: false, ...options });
}

export function cellText(sheet: WorkSheet, address: string) {
  const cell = sheet[address];
  return cell?.w ?? (cell?.v == null ? '' : String(cell.v));
}
