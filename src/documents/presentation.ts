import type { Element } from '@xmldom/xmldom';
import { attr, child, children, imageUri, openOfficePackage, relationshipId } from './open-xml';

type Frame = { x: number; y: number; width: number; height: number; rotation: number };
export type SlideText = { text: string; size: number; color?: string; bold: boolean; italic: boolean };
export type Paragraph = { runs: SlideText[]; align: 'left' | 'center' | 'right' };
export type SlideElement = Frame & {
  fill?: string;
  image?: string;
  paragraphs?: Paragraph[];
};

export type Slide = { elements: SlideElement[]; background: string; partial: boolean };

const positive = (value: string, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

function color(node?: Element) {
  const rgb = attr(child(node, 'srgbClr'), 'val');
  return /^[0-9a-f]{6}$/i.test(rgb) ? '#' + rgb : undefined;
}

function frame(node?: Element): Frame | undefined {
  const offset = child(node, 'off');
  const size = child(node, 'ext');
  const width = positive(attr(size, 'cx'), 0);
  const height = positive(attr(size, 'cy'), 0);
  if (!width || !height) return;
  return { x: Number(attr(offset, 'x')) || 0, y: Number(attr(offset, 'y')) || 0,
    width, height, rotation: (Number(attr(node, 'rot')) || 0) / 60000 };
}

function placeholder(shape: Element) {
  const props = children(shape).find(node => node.localName?.startsWith('nv'));
  return child(child(props, 'nvPr'), 'ph');
}

function paragraphs(textBody: Element, title: boolean): Paragraph[] {
  return children(textBody, 'p').map(paragraph => {
    const properties = child(paragraph, 'pPr');
    const defaults = child(properties, 'defRPr');
    const alignment = attr(properties, 'algn');
    const runs: SlideText[] = [];
    for (const run of children(paragraph)) {
      if (!['r', 'fld', 'br'].includes(run.localName ?? '')) continue;
      const style = child(run, 'rPr');
      runs.push({
        text: run.localName === 'br' ? '\n' : child(run, 't')?.textContent ?? '',
        size: positive(attr(style, 'sz') || attr(defaults, 'sz'), title ? 3200 : 1800),
        color: color(child(style, 'solidFill')) ?? color(child(defaults, 'solidFill')),
        bold: attr(style, 'b') === '1' || attr(defaults, 'b') === '1',
        italic: attr(style, 'i') === '1' || attr(defaults, 'i') === '1',
      });
    }
    if (child(properties, 'buChar') && runs.length) runs[0].text = attr(child(properties, 'buChar'), 'char') + ' ' + runs[0].text;
    return { runs, align: alignment === 'ctr' ? 'center' : alignment === 'r' ? 'right' : 'left' };
  });
}

export function readPresentation(bytes: Uint8Array) {
  const { parts, xml, relationships } = openOfficePackage(bytes, 'ppt/');
  const main = 'ppt/presentation.xml';
  const root = xml(main);
  const links = relationships(main);
  const paths = children(child(root, 'sldIdLst'), 'sldId').map(slide => links.find(link => link.id === relationshipId(slide))?.path);
  if (!paths.length || paths.some(path => !path)) throw new Error('This presentation has no readable slides.');
  const size = child(root, 'sldSz');
  const width = positive(attr(size, 'cx'), 9144000);
  const height = positive(attr(size, 'cy'), 6858000);

  function slideAt(index: number): Slide {
    const path = paths[index];
    if (!path) throw new Error('Slide unavailable.');
    const slide = child(xml(path), 'cSld');
    const tree = child(slide, 'spTree');
    if (!tree) throw new Error('Slide content unavailable.');
    const rels = relationships(path);
    const layoutPath = rels.find(rel => rel.type.endsWith('/slideLayout'))?.path;
    const layout = layoutPath ? child(xml(layoutPath), 'cSld') : undefined;
    const masterPath = layoutPath && relationships(layoutPath).find(rel => rel.type.endsWith('/slideMaster'))?.path;
    const master = masterPath ? child(xml(masterPath), 'cSld') : undefined;
    const background = [slide, layout, master].map(part => color(child(child(child(part, 'bg'), 'bgPr'), 'solidFill'))).find(Boolean) ?? '#FFFFFF';
    const elements: SlideElement[] = [];
    let partial = false;
    for (const shape of children(tree)) {
      if (['nvGrpSpPr', 'grpSpPr'].includes(shape.localName ?? '')) continue;
      if (shape.localName !== 'sp' && shape.localName !== 'pic') {
        partial = true;
        continue;
      }
      const props = child(shape, 'spPr');
      const marker = placeholder(shape);
      const role = attr(marker, 'type');
      const title = role === 'title' || role === 'ctrTitle';
      const template = marker && [layout, master].flatMap(part => children(child(part, 'spTree'), 'sp')).find(candidate => {
        const reference = placeholder(candidate);
        return reference && (attr(marker, 'idx')
          ? attr(marker, 'idx') === attr(reference, 'idx')
          : role === attr(reference, 'type'));
      });
      const position = frame(child(props, 'xfrm')) ?? frame(child(child(template, 'spPr'), 'xfrm')) ??
        (marker ? { x: width * 0.07, y: height * (title ? 0.06 : 0.25), width: width * 0.86,
          height: height * (title ? 0.18 : 0.66), rotation: 0 } : undefined);
      if (!position) {
        partial = true;
        continue;
      }
      if (shape.localName === 'pic') {
        const id = relationshipId(child(child(shape, 'blipFill'), 'blip'), 'embed');
        const imagePath = rels.find(rel => rel.id === id && rel.type.endsWith('/image'))?.path;
        const source = imagePath && parts[imagePath] ? imageUri(parts[imagePath], imagePath) : undefined;
        if (source) elements.push({ ...position, image: source });
        else partial = true;
        continue;
      }
      const body = child(shape, 'txBody');
      const fill = color(child(props, 'solidFill'));
      if (fill || body) elements.push({ ...position, fill, paragraphs: body && paragraphs(body, title) });
      if (child(props, 'gradFill') || child(props, 'custGeom')) partial = true;
    }
    return { elements, background, partial };
  }

  return { width, height, count: paths.length, slideAt };
}

export type Presentation = ReturnType<typeof readPresentation>;
