import type { WordBlock, WordParagraph, WordSection } from './word';

function paragraphHeight(paragraph: WordParagraph, width: number) {
  const fontSize = paragraph.runs.reduce((largest, run) => Math.max(largest, run.size ?? 15), 0) || 15;
  const inner = Math.max(1, width - paragraph.left - paragraph.right);
  const text = paragraph.runs.map(run => run.text).join('');
  const chars = Math.max(1, Math.floor(inner / (fontSize * 0.53)));
  const lines = text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / chars)), 0);
  const images = paragraph.images.reduce((height, image) => height + Math.min(inner, image.width ?? inner) / image.ratio, 0);
  return paragraph.before + paragraph.after + (text || !images ? lines * wordLineHeight(paragraph, fontSize) : 0) + images;
}

export function wordLineHeight(paragraph: WordParagraph, fontSize: number) {
  const normal = fontSize * 1.2;
  if (paragraph.line === undefined) return normal;
  if (paragraph.lineRule === 'exact') return paragraph.line / 15;
  if (paragraph.lineRule === 'atLeast') return Math.max(normal, paragraph.line / 15);
  return normal * paragraph.line / 240;
}

function hasContent(block: WordBlock) {
  return block.type === 'table' ? block.rows.length > 0 :
    block.images.length > 0 || block.runs.some(run => run.text.trim().length > 0);
}

export function layoutWordPages(sections: WordSection[]): WordSection[] {
  const pages: WordSection[] = [];
  for (const section of sections) {
    const { setup, blocks } = section;
    const width = Math.max(1, setup.width - setup.left - setup.right);
    const height = Math.max(1, setup.height - setup.top - setup.bottom);
    let current: WordBlock[] = [];
    let filled = 0;
    let firstPage = true;
    const hasSavedBreaks = blocks.some(block => block.type === 'paragraph' && block.renderedBreak);
    const next = () => {
      if (current.some(hasContent)) {
        pages.push({ ...section, blocks: current, firstPage });
        firstPage = false;
      }
      current = [];
      filled = 0;
    };
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        const size = paragraphHeight(block, width);
        if (block.pageBreak || (!hasSavedBreaks && filled + size > height)) next();
        current.push(block);
        filled += size;
        continue;
      }
      let rows: typeof block.rows = [];
      for (const row of block.rows) {
        const size = Math.max(0, ...row.map(cell => cell.reduce((sum, p) =>
          sum + paragraphHeight(p, Math.max(1, width / row.length - 12)), 0))) + 12;
        if (!hasSavedBreaks && filled + size > height && (rows.length || current.length)) {
          if (rows.length) current.push({ type: 'table', rows });
          next();
          rows = [];
        }
        rows.push(row);
        filled += size;
      }
      if (rows.length) current.push({ type: 'table', rows });
    }
    next();
  }
  return pages;
}
