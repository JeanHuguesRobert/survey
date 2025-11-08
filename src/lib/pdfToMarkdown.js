import { extractText, renderPageAsImage } from 'unpdf';

/**
 * Options for the PDF to Markdown conversion helper.
 * @typedef {Object} PdfToMarkdownOptions
 * @property {number} [baseHeadingLevel=2] - Markdown heading level used for detected titles.
 * @property {boolean} [includePageBreaks=true] - When true, inserts a heading before each page section.
 * @property {boolean} [ocrImages=false] - Enables page-level OCR when almost no text is extracted from a page.
 * @property {string|string[]} [ocrLanguages='fra+eng'] - Languages passed to Tesseract when OCR is enabled.
 * @property {number} [ocrTextThreshold=32] - Minimum number of extracted characters required to skip OCR fallback.
 * @property {number} [ocrScale=2] - Rendering scale used before sending a page image to the OCR engine.
 * @property {Object} [ocrParameters] - Optional parameters forwarded to `worker.setParameters`.
 * @property {(markdown: string, context: PdfToMarkdownContext) => Promise<string|PdfToMarkdownAiResult>|string|PdfToMarkdownAiResult} [aiRefiner]
 *   Optional callback used to refine the produced Markdown with an external LLM.
 */

/**
 * @typedef {Object} PdfToMarkdownContext
 * @property {number} totalPages
 * @property {number[]} ocrPages
 * @property {string[]} pageMarkdown
 */

/**
 * @typedef {Object} PdfToMarkdownAiResult
 * @property {string} markdown
 * @property {Record<string, any>} [meta]
 */

export const DEFAULT_OPTIONS = {
  baseHeadingLevel: 2,
  includePageBreaks: true,
  ocrImages: false,
  ocrLanguages: 'fra+eng',
  ocrTextThreshold: 32,
  ocrScale: 2,
};

/**
 * Converts a PDF buffer or typed array into Markdown text. The function combines
 * native PDF text extraction with an optional OCR fallback (useful for scanned
 * documents or images) and simple heuristics to format headings, bullet lists
 * and paragraphs.
 *
 * @param {ArrayBuffer | Uint8Array | Buffer} pdfData - Raw binary data of the PDF document.
 * @param {PdfToMarkdownOptions} [options]
 * @returns {Promise<{ markdown: string, pages: string[], meta: Record<string, any> }>} markdown result with metadata.
 */
export async function convertPdfToMarkdown(pdfData, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  const { text: pages, totalPages } = await extractText(pdfData, { mergePages: false });
  const pageMarkdown = [];
  const ocrPages = [];

  let ocrWorker = null;

  try {
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = index + 1;
      let pageText = sanitisePageText(pages[index] ?? '');

      if (settings.ocrImages && needsOcr(pageText, settings.ocrTextThreshold)) {
        const ocrResult = await runOcrOnPage(pdfData, pageNumber, settings, ensureOcrWorker);
        if (ocrResult.trim()) {
          pageText = ocrResult;
          ocrPages.push(pageNumber);
        }
      }

      const markdown = formatPage(pageText, pageNumber, settings);
      pageMarkdown.push(markdown);
    }
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  }

  async function ensureOcrWorker() {
    if (!ocrWorker) {
      const { createWorker } = await import('tesseract.js');
      ocrWorker = await createWorker(settings.ocrLanguages);
      if (settings.ocrParameters) {
        await ocrWorker.setParameters(settings.ocrParameters);
      }
    }
    return ocrWorker;
  }

  let markdown = composeDocument(pageMarkdown, settings);

  let aiMeta;
  if (typeof settings.aiRefiner === 'function') {
    const context = { totalPages, ocrPages, pageMarkdown };
    const refined = await settings.aiRefiner(markdown, context);
    if (typeof refined === 'string') {
      markdown = refined;
    } else if (refined && typeof refined === 'object') {
      if (typeof refined.markdown === 'string') {
        markdown = refined.markdown;
      }
      if (refined.meta) {
        aiMeta = refined.meta;
      }
    }
  }

  return {
    markdown,
    pages: pageMarkdown,
    meta: {
      totalPages,
      ocrPages,
      ...(aiMeta ? { ai: aiMeta } : {}),
    },
  };

  async function runOcrOnPage(data, pageNumber, opts, workerFactory) {
    try {
      const dataUrl = await renderPageAsImage(data, pageNumber, {
        scale: opts.ocrScale,
        toDataURL: true,
      });
      const worker = await workerFactory();
      const { data: { text } } = await worker.recognize(dataUrl);
      return text;
    } catch (error) {
      console.warn(`OCR fallback failed on page ${pageNumber}:`, error);
      return '';
    }
  }
}

export function composeDocument(pageMarkdown, settings) {
  if (!settings.includePageBreaks) {
    return pageMarkdown.join('\n\n');
  }
  return pageMarkdown
    .map((content, index) => {
      const headingLevel = Math.max(1, settings.baseHeadingLevel - 1);
      const prefix = '#'.repeat(headingLevel);
      return `${prefix} Page ${index + 1}\n\n${content}`.trim();
    })
    .join('\n\n---\n\n');
}

export function needsOcr(text, threshold) {
  return text.replace(/\s+/g, '').length < threshold;
}

export function formatPage(text, pageNumber, settings) {
  const lines = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0));

  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = null;

  const pushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push(joinParagraphLines(paragraphBuffer));
    paragraphBuffer = [];
  };

  const pushList = () => {
    if (!listBuffer || !listBuffer.items.length) return;
    const marker = listBuffer.kind === 'ordered' ? '1.' : '-';
    const listMarkdown = listBuffer.items
      .map((item, idx) => {
        if (listBuffer.kind === 'ordered') {
          return `${listBuffer.start + idx}. ${item}`;
        }
        return `${marker} ${item}`;
      })
      .join('\n');
    blocks.push(listMarkdown);
    listBuffer = null;
  };

  lines.forEach((line) => {
    if (!line.length) {
      pushParagraph();
      pushList();
      return;
    }

    if (isProbableHeading(line)) {
      pushParagraph();
      pushList();
      const headingLevel = '#'.repeat(settings.baseHeadingLevel);
      blocks.push(`${headingLevel} ${normaliseHeading(line)}`);
      return;
    }

    const listMatch = parseListLine(line);
    if (listMatch) {
      pushParagraph();
      if (!listBuffer || listBuffer.kind !== listMatch.kind) {
        pushList();
        listBuffer = { ...listMatch, items: [] };
      }
      if (listBuffer.kind === 'ordered' && typeof listBuffer.start !== 'number') {
        listBuffer.start = listMatch.start ?? 1;
      }
      listBuffer.items.push(listMatch.content);
      return;
    }

    pushList();
    paragraphBuffer.push(line);
  });

  pushParagraph();
  pushList();

  return blocks.join('\n\n').trim();
}

export function sanitisePageText(text) {
  return text
    .replace(/\u0000/g, '')
    .replace(/\f/g, '\n')
    .replace(/\s+$/gm, '')
    .trim();
}

export function joinParagraphLines(lines) {
  return lines.reduce((acc, line) => {
    if (!acc) return line;
    if (/[-–—]$/.test(acc)) {
      return acc.replace(/[-–—]$/, '') + line.replace(/^\s+/, '');
    }
    if (/^[,.;:!?]/.test(line)) {
      return `${acc}${line}`;
    }
    return `${acc} ${line}`;
  }, '');
}

export function isProbableHeading(line) {
  if (line.length < 3) return false;
  if (/^(ARTICLE|CHAPITRE|SECTION)\s+\d+/i.test(line)) return true;
  const words = line.split(/\s+/);
  const letters = line.replace(/[^A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸa-zàâäçéèêëïîôöùûüÿ]/g, '');
  if (letters.length === 0) return false;
  const averageLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const uppercaseRatio = (line.replace(/[^A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸ]/g, '').length) / letters.length;
  return uppercaseRatio > 0.6 && averageLength < 12;
}

export function normaliseHeading(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseListLine(line) {
  const bulletMatch = line.match(/^([\-*•●▪◦])\s+(.*)$/);
  if (bulletMatch) {
    return {
      kind: 'unordered',
      content: bulletMatch[2].trim(),
    };
  }
  const orderedMatch = line.match(/^(\d+)[\.)]\s+(.*)$/);
  if (orderedMatch) {
    return {
      kind: 'ordered',
      start: Number.parseInt(orderedMatch[1], 10),
      content: orderedMatch[2].trim(),
    };
  }
  return null;
}

export default convertPdfToMarkdown;
