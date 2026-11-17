import { DOMParser, type Element } from '@xmldom/xmldom';
import { fromByteArray } from 'base64-js';
import { strFromU8 } from 'fflate';
import { officeZip } from './office-file';

export const children = (node?: Element, name?: string) =>
  Array.from(node?.childNodes ?? []).filter((child): child is Element =>
    child.nodeType === 1 && (!name || (child as Element).localName === name));
export const child = (node: Element | undefined, name: string) => children(node, name)[0];
export const attr = (node: Element | undefined, name: string) => node?.getAttribute(name) ?? '';

function resolvePart(part: string, target: string) {
  const segments = target.startsWith('/') ? [] : part.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') segments.pop();
    else if (piece && piece !== '.') segments.push(piece);
  }
  return segments.join('/');
}


export function relationshipId(node?: Element, attribute = 'id') {
  return Array.from(node?.attributes ?? []).find(item => item.localName === attribute &&
    item.namespaceURI?.endsWith('/relationships'))?.value ?? '';
}


export function imageUri(bytes: Uint8Array, path: string) {
  const type = path.split('.').at(-1)?.toLowerCase();
  if (!type || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(type)) return;
  return `data:image/${type === 'jpg' ? 'jpeg' : type};base64,${fromByteArray(bytes)}`;
}


export function openOfficePackage(bytes: Uint8Array, prefix: string) {
  const parts = officeZip(bytes, name => name.startsWith(prefix) && /\.(xml|rels|png|jpe?g|gif|webp|bmp)$/i.test(name));
  function xml(path: string) {
    const entry = parts[path];
    if (!entry) return undefined;
    const text = strFromU8(entry);
    if (/<!DOCTYPE/i.test(text)) throw new Error('Unsupported Office XML.');
    return new DOMParser().parseFromString(text, 'application/xml').documentElement ?? undefined;
  }

  function relationships(path: string) {
    const slash = path.lastIndexOf('/');
    const rels = xml(path.slice(0, slash + 1) + '_rels/' + path.slice(slash + 1) + '.rels');
    return children(rels, 'Relationship').filter(rel => attr(rel, 'TargetMode') !== 'External').map(rel => ({
      id: attr(rel, 'Id'), type: attr(rel, 'Type'), path: resolvePart(path, attr(rel, 'Target')),
    }));
  }
  return { parts, xml, relationships };
}
