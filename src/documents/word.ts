import type { Element } from '@xmldom/xmldom';
import { attr, child, children, imageUri, openOfficePackage, relationshipId } from './open-xml';

type WordStyle = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; font?: 'serif' | 'monospace' | 'sans-serif' };
type WordRun = WordStyle & { text: string };
type WordPicture = { uri: string; ratio: number; width?: number };
export type WordParagraph = {
  type: 'paragraph'; runs: WordRun[]; images: WordPicture[];
  align: 'left' | 'center' | 'right' | 'justify'; list: boolean;
  before: number; after: number; left: number; right: number; line?: number; lineRule?: string;
  pageBreak?: boolean; renderedBreak?: boolean;
};
export type WordTable = { type: 'table'; rows: WordParagraph[][][] };
export type WordBlock = WordParagraph | WordTable;
export type WordPageSetup = { width: number; height: number; top: number; bottom: number; left: number; right: number;
  header: number; footer: number; gutter: number; vertical: 'flex-start' | 'center' | 'flex-end' | 'space-between' };
type PageBand = { default?: WordParagraph[]; first?: WordParagraph[] };
export type WordSection = { setup: WordPageSetup; blocks: WordBlock[]; header?: PageBand; footer?: PageBand;
  distinctFirst?: boolean; firstPage?: boolean };

function localAttribute(node: Element | undefined, name: string) {
  return Array.from(node?.attributes ?? []).find(attribute => attribute.localName === name)?.value ?? '';
}

function value(node?: Element) {
  return localAttribute(node, 'val');
}

function twips(node: Element | undefined, name: string, fallback: number) {
  const raw = localAttribute(node, name);
  const number = Number(raw);
  return raw !== '' && Number.isFinite(number) && number >= 0 ? number / 15 : fallback;
}

function pageSetup(section?: Element, previous?: WordPageSetup): WordPageSetup {
  const size = child(section, 'pgSz');
  const margins = child(section, 'pgMar');
  const width = twips(size, 'w', previous?.width ?? 816) || 816;
  const height = twips(size, 'h', previous?.height ?? 1056) || 1056;
  const vertical = value(child(section, 'vAlign'));
  const gutter = twips(margins, 'gutter', previous?.gutter ?? 0);
  return { width, height, top: twips(margins, 'top', previous?.top ?? 96), bottom: twips(margins, 'bottom', previous?.bottom ?? 96),
    left: twips(margins, 'left', previous ? previous.left - previous.gutter : 96) + gutter,
    right: twips(margins, 'right', previous?.right ?? 96), gutter,
    header: twips(margins, 'header', previous?.header ?? 48), footer: twips(margins, 'footer', previous?.footer ?? 48),
    vertical: vertical === 'center' ? 'center' : vertical === 'bottom' ? 'flex-end' :
      vertical === 'both' ? 'space-between' : vertical === 'top' ? 'flex-start' : previous?.vertical ?? 'flex-start' };
}

function inheritedStyle(node?: Element, theme?: { major: string; minor: string }): WordStyle {
  const result: WordStyle = {};
  const size = Number(value(child(node, 'sz')));
  if (size > 0 && Number.isFinite(size)) result.size = Math.min(96, size * 2 / 3);
  const color = value(child(node, 'color'));
  if (/^[a-f\d]{6}$/i.test(color)) result.color = '#' + color;
  const fonts = child(node, 'rFonts');
  const themeFont = localAttribute(fonts, 'asciiTheme') || localAttribute(fonts, 'hAnsiTheme');
  const font = (themeFont.startsWith('major') ? theme?.major : themeFont.startsWith('minor') ? theme?.minor : undefined)
    || localAttribute(fonts, 'ascii') || localAttribute(fonts, 'hAnsi');
  if (font) result.font = /times|cambria|garamond|georgia|serif/i.test(font) ? 'serif'
    : /courier|consolas|mono/i.test(font) ? 'monospace' : 'sans-serif';
  for (const [property, tag] of [['bold', 'b'], ['italic', 'i'], ['underline', 'u']] as const) {
    const element = child(node, tag);
    if (element) result[property] = !['0', 'false', 'off', 'none'].includes(value(element));
  }
  return result;
}

export function readWord(bytes: Uint8Array): WordSection[] {
  const { parts, xml, relationships } = openOfficePackage(bytes, 'word/');
  const path = 'word/document.xml';
  const body = child(xml(path), 'body');
  if (!body) throw new Error('Document body is missing.');
  const rels = relationships(path);
  const themePart = rels.find(rel => rel.type.endsWith('/theme'));
  const fontScheme = themePart ? child(child(xml(themePart.path), 'themeElements'), 'fontScheme') : undefined;
  const theme = {
    major: attr(child(child(fontScheme, 'majorFont'), 'latin'), 'typeface'),
    minor: attr(child(child(fontScheme, 'minorFont'), 'latin'), 'typeface'),
  };
  const styles = xml('word/styles.xml');
  const imageCache = new Map<string, string>();
  const styleList = children(styles, 'style');
  const defaults = inheritedStyle(child(child(child(styles, 'docDefaults'), 'rPrDefault'), 'rPr'), theme);
  const paragraphDefaults = child(child(child(styles, 'docDefaults'), 'pPrDefault'), 'pPr');
  const normalStyle = styleList.find(item => localAttribute(item, 'type') === 'paragraph' && localAttribute(item, 'default') === '1');

  function resolveStyle(id: string, depth = 0): WordStyle {
    const style = depth < 8 && styleList.find(item =>
      Array.from(item.attributes).some(attribute => attribute.localName === 'styleId' && attribute.value === id));
    if (!style) return {};
    const parent = value(child(style, 'basedOn'));
    return { ...(parent ? resolveStyle(parent, depth + 1) : {}), ...inheritedStyle(child(style, 'rPr'), theme) };
  }

  function paragraphProperties(id: string, depth = 0): Element[] {
    const style = depth < 8 && styleList.find(item => localAttribute(item, 'styleId') === id);
    if (!style) return [];
    const parent = value(child(style, 'basedOn'));
    return [...children(style, 'pPr'), ...(parent ? paragraphProperties(parent, depth + 1) : [])];
  }

  function paragraphs(node: Element, partRelationships = rels): WordParagraph[] {
    const pPr = child(node, 'pPr');
    const id = value(child(pPr, 'pStyle')) || localAttribute(normalStyle, 'styleId');
    const heading = /^heading\s*[1-9]$/i.test(id) || id.toLowerCase() === 'title';
    const base = { ...defaults, ...(heading ? { size: 24, bold: true } : {}), ...resolveStyle(id), ...inheritedStyle(child(pPr, 'rPr'), theme) };
    const propertyChain = [pPr, ...paragraphProperties(id), paragraphDefaults];
    const property = (name: string) => propertyChain.map(node => child(node, name)).find(Boolean);
    const align = value(property('jc'));
    const source = (tag: string, name: string) =>
      propertyChain.map(node => child(node, tag)).find(node => localAttribute(node, name) !== '');
    const before = twips(source('spacing', 'before'), 'before', 0);
    const after = twips(source('spacing', 'after'), 'after', 0);
    const left = twips(source('ind', 'start'), 'start', twips(source('ind', 'left'), 'left', 0));
    const right = twips(source('ind', 'end'), 'end', twips(source('ind', 'right'), 'right', 0));
    const line = Number(localAttribute(source('spacing', 'line'), 'line')) || undefined;
    const lineRule = localAttribute(source('spacing', 'lineRule'), 'lineRule') || undefined;
    const fragments: WordParagraph[] = [];
    const breakBefore = property('pageBreakBefore');
    let pageBreak = Boolean(breakBefore && !['0', 'false', 'off'].includes(value(breakBefore)));
    let renderedBreak = false;
    let runs: WordRun[] = [];
    let images: WordPicture[] = [];
    function finish(afterSpacing = after) {
      fragments.push({ type: 'paragraph', runs, images, list: fragments.length === 0 && Boolean(child(pPr, 'numPr')),
        align: align === 'center' || align === 'right' ? align : align === 'both' ? 'justify' : 'left',
        before: fragments.length === 0 ? before : 0, after: afterSpacing, left, right, line, lineRule, pageBreak, renderedBreak });
      runs = [];
      images = [];
    }
    const inline = children(node).flatMap(item =>
      ['hyperlink', 'ins', 'smartTag'].includes(item.localName ?? '') ? children(item, 'r') : [item]);
    for (const run of inline) {
      if (run.localName !== 'r') continue;
      const rPr = child(run, 'rPr');
      const style = { ...base, ...resolveStyle(value(child(rPr, 'rStyle'))), ...inheritedStyle(rPr, theme) };
      for (const item of children(run)) {
        const tag = item.localName;
        if (tag === 'lastRenderedPageBreak' || (tag === 'br' && localAttribute(item, 'type') === 'page')) {
          if (runs.length || images.length) finish(0);
          pageBreak = true;
          renderedBreak = tag === 'lastRenderedPageBreak';
          continue;
        }
        const text = tag === 't' ? item.textContent : tag === 'br' || tag === 'cr' ? '\n' : tag === 'tab' ? '    ' : '';
        if (text) runs.push({ text, ...style });
        if (tag !== 'drawing') continue;
        const drawing = item;
        const blip = Array.from(drawing.getElementsByTagNameNS('*', 'blip'))[0];
        const extent = Array.from(drawing.getElementsByTagNameNS('*', 'extent'))[0];
        const related = partRelationships.find(rel => rel.type.endsWith('/image') && rel.id === relationshipId(blip, 'embed'));
        if (!related || !parts[related.path]) continue;
        const uri = imageCache.get(related.path) ?? imageUri(parts[related.path], related.path);
        if (!uri) continue;
        imageCache.set(related.path, uri);
        const width = Number(attr(extent, 'cx')) / 9525;
        const ratio = Number(attr(extent, 'cx')) / Number(attr(extent, 'cy'));
        images.push({ uri, ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5,
          width: Number.isFinite(width) && width > 0 ? width : undefined });
      }
    }
    finish();
    return fragments;
  }

  const sections: WordSection[] = [];
  let blocks: WordBlock[] = [];
  function finishSection(section?: Element) {
    const previous = sections.at(-1);
    function band(kind: 'header' | 'footer'): PageBand {
      const result: PageBand = { ...previous?.[kind] };
      for (const ref of children(section, kind + 'Reference')) {
        const type = localAttribute(ref, 'type');
        if (type !== 'default' && type !== 'first') continue;
        const target = rels.find(rel => rel.id === relationshipId(ref) && rel.type.endsWith('/' + kind));
        if (!target) continue;
        const links = relationships(target.path);
        result[type] = children(xml(target.path), 'p').flatMap(node => paragraphs(node, links));
      }
      return result;
    }
    const title = child(section, 'titlePg');
    sections.push({ setup: pageSetup(section, previous?.setup), blocks, header: band('header'), footer: band('footer'),
      distinctFirst: Boolean(title && !['0', 'false', 'off'].includes(value(title))) });
    blocks = [];
  }
  for (const node of children(body)) {
    if (node.localName === 'p') {
      blocks.push(...paragraphs(node));
      const section = child(child(node, 'pPr'), 'sectPr');
      if (section) {
        finishSection(section);
      }
    }
    if (node.localName === 'tbl') {
      blocks.push({ type: 'table', rows: children(node, 'tr').map(row =>
        children(row, 'tc').map(cell => children(cell, 'p').flatMap(node => paragraphs(node)))) });
    }
  }
  if (blocks.length) finishSection(child(body, 'sectPr'));
  return sections;
}
