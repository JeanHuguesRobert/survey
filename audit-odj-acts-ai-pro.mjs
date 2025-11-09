// ESM, Node 20+
// Variable d'env requise : OPENAI_API_KEY
// Optionnelles : OCR_ENABLED, CANON_MODEL, EMBED_MODEL, JUDGE_MODEL, LOW_SIM, HIGH_SIM

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import os from 'node:os';
import OpenAI from 'openai';
import { convertPdfToMarkdown } from './src/lib/pdfToMarkdown.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const OFFICIEL_DIR  = path.join(process.cwd(), 'public', 'docs', 'officiel');
const CONSEIL_DIR   = path.join(process.cwd(), 'public', 'docs', 'conseil');   // searchable
await fs.mkdir(CONSEIL_DIR, { recursive: true });

function pythonLauncher() {
  return process.platform === 'win32' ? ['py','-3.13'] : [process.env.PYTHON || 'python3'];
}


const USE_MARKITDOWN = true;

/**
 * Produit une copie "searchable" via OCRmyPDF dans public/docs/conseil/.
 * Si le fichier existe déjà, on le réutilise.
 * @param {string} srcOfficialPath  chemin du PDF original (public/docs/officiel/…)
 * @returns {Promise<string>}       chemin du PDF searchable (public/docs/conseil/…)
 */
async function ensureSearchablePdf(srcOfficialPath) {
  const base = path.basename(srcOfficialPath);
  const dst  = path.join(CONSEIL_DIR, base.replace(/\.pdf$/i, '.pdf')); // même nom
  try {
    await fs.access(dst);
    return dst; // cache
  } catch {}

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocrmd-'));
  const tmpOut = path.join(tmpDir, base);

  const [cmd, ...pre] = pythonLauncher();
  const args = [...pre, '-m', 'ocrmypdf',
    '-l', 'fra+eng',
    '--force-ocr',         // force OCR si images seules
    srcOfficialPath, tmpOut
  ];

  try {
    const { stderr } = await execFileP(cmd, args, { windowsHide: true });
    if (stderr?.trim()) console.warn(stderr.trim());
    // move atomique
    await fs.copyFile(tmpOut, dst);
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
  return dst;
}




async function pdfToMarkdown(pdfPath, u8, opts = {}) {
  const absIn  = path.resolve(pdfPath);
  const mdPath = absIn.replace(/\.pdf$/i, '.md');

  if (mdCache[mdPath]) return mdCache[mdPath];

  let mdText = '';

  if (!USE_MARKITDOWN) {
    // convertPdfToMarkdown attend des octets, pas un chemin
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(await fs.readFile(absIn));
    const out = await convertPdfToMarkdown(bytes, opts);
    mdText = typeof out === 'string' ? out
           : (typeof out?.markdown === 'string' ? out.markdown : '');
    if (!mdText) return { error: 'convertPdfToMarkdown: markdown vide' };
  } else {
    // exécution MarkItDown via le lanceur Python
    const tmpDir  = await fs.mkdtemp(path.join(os.tmpdir(), 'markitdown-'));
    const outPath = path.join(tmpDir, path.basename(mdPath));
    const launcher = process.platform === 'win32' ? 'py' : (process.env.PYTHON || 'python3');

    try {
      const { stderr } = await execFileP(
        launcher,
        ['-m', 'markitdown', absIn, '-o', outPath],
        { windowsHide: true }
      );
      if (stderr) console.warn(stderr.trim());
      mdText = await fs.readFile(outPath, 'utf8');
    } catch (e) {
      const msg = e?.stderr?.toString?.().trim() || e?.message || String(e);
      console.error('  ❌ markitdown a échoué :', msg);
      return { error: msg };
    } finally {
      // nettoyage best-effort
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  // cache + persistance à côté du PDF
  mdCache[mdPath] = mdText;

  return mdText;
}

// ---------- Configuration ----------
if (!process.env.OPENAI_API_KEY) {
  console.error('Erreur : OPENAI_API_KEY manquant (.env ou variable d’environnement).');
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OCR_ENABLED = (process.env.OCR_ENABLED ?? '1') !== '0';
const CANON_MODEL = process.env.CANON_MODEL || 'gpt-5';
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large';
const JUDGE_MODEL = process.env.JUDGE_MODEL || CANON_MODEL;
const LOW_SIM  = Number.parseFloat(process.env.LOW_SIM  || '0.55');
const HIGH_SIM = Number.parseFloat(process.env.HIGH_SIM || '0.82');

// ---------- Caches en mémoire ----------
const pdfCache = new Map();           // key: `pdfText-<path>` -> string
const mdCache  = Object.create(null); // key: md absolute path   -> string

// ---------- CLI ----------
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const [k, vRaw] = a.includes('=') ? a.split('=') : [a, true];
    const key = k.replace(/^--?/, '').toLowerCase().replace(/-/g, '_');
    out[key] = vRaw === true ? true : vRaw;
  }
  return out;
}
const args = parseArgs(process.argv);

// ---------- HTTP utils ----------
function absUrl(base, href) {
  try { return new URL(href, base).toString(); }
  catch { return `${base.replace(/\/+$/,'')}/${href.replace(/^\/+/,'')}`; }
}

/**
 * Télécharge une ressource binaire en gérant les redirections.
 * Retourne un Uint8Array "pur" (pas de Buffer).
 */
async function fetchBytes(url, {
  maxRedirects = 5,
  timeoutMs = 30000,
  headers = {
    'User-Agent': 'Audit-ODJ/1.0',
    'Accept': 'application/pdf,*/*;q=0.8',
    'Accept-Language': 'fr,en;q=0.9',
    'Referer': url
  }
} = {}) {
  const visited = new Set();
  return await new Promise((resolve, reject) => {
    function go(u, left) {
      if (left < 0) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https:') ? https : http;
      const req = lib.get(u, { headers, timeout: timeoutMs }, (res) => {
        // Redirection
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, u).toString();
          if (visited.has(next)) { res.resume(); return reject(new Error('Redirect loop')); }
          visited.add(next);
          res.resume();
          return go(next, left - 1);
        }
        // Erreur HTTP
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        // OK
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const out = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength); // pur
          resolve(out);
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => { req.destroy(new Error('Timeout')); });
    }
    go(url, maxRedirects);
  });
}

// ---------- Archivage PDF ----------
function makeArchiveBaseName(fromUrl) {
  let origName = 'document.pdf';
  try {
    const u = new URL(fromUrl);
    const baseName = path.basename(u.pathname) || origName;
    if (/modules\.php$/i.test(baseName)) {
      const lid = u.searchParams.get('lid') || '';
      const nameParam = u.searchParams.get('name') || '';
      if (nameParam && lid) origName = `${nameParam}-${lid}.pdf`;
      else if (nameParam)  origName = `${nameParam}.pdf`;
      else if (lid)        origName = `document-${lid}.pdf`;
      else                 origName = 'document.pdf';
    } else {
      origName = baseName;
    }
  } catch { /* ignore */ }
  return origName;
}

function safeFileName(s) {
  return s.normalize('NFKD')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function mapDocType(docType) {
  const m = { odj: 'convocation-odj', pv: 'proces-verbal', delib: 'deliberations', deliberation: 'deliberations' };
  return m[(docType || '').toLowerCase()] || 'document';
}

/**
 * Écrit les bytes dans public/docs/officiel, sinon fallback tmp, sinon /tmp.
 * Retourne le chemin final ou lève en cas d’échec total.
 */
async function savePdfArchive(bytesUint8, url, dateLabel = '', docType = '') {
  const typeLabel = mapDocType(docType);
  const datePart  = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());
  const baseName  = makeArchiveBaseName(url);
  const rawName   = `mairie-corte_${typeLabel}_${datePart}_${baseName}`;
  const fileName  = safeFileName(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`);

  const primaryDir  = path.join(process.cwd(), 'public', 'docs', 'officiel');
  const fallbackDir = path.join(process.cwd(), 'tmp', 'officiel');
  const systemDir   = path.join(os.tmpdir(), 'audit-odj-officiel');

  const tryWrite = async (dir) => {
    try {
      await fs.mkdir(dir, { recursive: true });
      const outPath = path.join(dir, fileName);
      await fs.writeFile(outPath, Buffer.from(bytesUint8));
      return outPath;
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  };

  const p1 = await tryWrite(primaryDir);
  if (typeof p1 === 'string') { console.log(`  📁 Archive PDF : ${path.relative(process.cwd(), p1)}`); return p1; }
  console.warn(`  ⚠ Impossible d’écrire dans ${primaryDir}: ${p1.error}`);

  const p2 = await tryWrite(fallbackDir);
  if (typeof p2 === 'string') { console.log(`  📁 Archive PDF (fallback): ${path.relative(process.cwd(), p2)}`); return p2; }
  console.warn(`  ⚠ Impossible d’écrire dans ${fallbackDir}: ${p2.error}`);

  const p3 = await tryWrite(systemDir);
  if (typeof p3 === 'string') { console.log(`  📁 Archive PDF (/tmp): ${p3}`); return p3; }

  console.error('  ❌ Archivage PDF impossible sur tous les emplacements', { primary: p1.error, fallback: p2.error, system: p3.error });
  throw new Error('All archive locations failed');
}

/**
 * Retourne un chemin local d’archive pour un PDF distant.
 * Télécharge et archive si absent.
 */
async function getArchivedPdfPath(pdfUrl, dateLabel = '', docType = '') {
  const typeLabel = mapDocType(docType);
  const datePart  = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());
  const rawName   = `mairie-corte_${typeLabel}_${datePart}_${makeArchiveBaseName(pdfUrl)}`;
  const safeName  = safeFileName(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`);
  const expected  = path.join(process.cwd(), 'public', 'docs', 'officiel', safeName);

  try {
    await fs.access(expected);
    return expected;
  } catch {
    const bytes = await fetchBytes(pdfUrl);
    return await savePdfArchive(bytes, pdfUrl, dateLabel, docType);
  }
}

// ---------- Extraction markdown mise en cache ----------


async function getCachedPdfText(pdfPath, dateLabel, docType) {
  const cacheKey = `pdfText-${pdfPath}`;
  if (pdfCache.has(cacheKey)) return pdfCache.get(cacheKey);

  console.log(`  📄 Extraction texte PDF : ${dateLabel} (${docType})`);

  let fileBuf;
  try {
    fileBuf = await fs.readFile(pdfPath); // Buffer
  } catch (error) {
    console.error(`  ❌ Lecture PDF ${pdfPath} : ${error.message}`);
    return { error: error.message };
  }

  const u8 = new Uint8Array(fileBuf);
  const call = async (withOcr) => {
    const opts = {
      ocrImages: withOcr,
      aiRefiner: async (markdown, context) => {
        const { totalPages, ocrPages } = context || {};
        console.log(`    🤖 Affinage IA (OCR: ${ocrPages?.length || 0}/${totalPages || 0})`);
        try {
          const res = await client.chat.completions.create({
            model: CANON_MODEL,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `Nettoie un texte OCR de PDF. Retourne strictement {"text":"..."} sans ajout.` },
              { role: 'user', content: `Nettoie :\n${markdown}` }
            ],
            temperature: 0.1
          });
          const content = res.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(content);
          if (typeof parsed.text === 'string' && parsed.text.trim()) return parsed.text;
        } catch (e) {
          console.warn('    ⚠ Affinage IA ignoré :', e?.message || e);
        }
        return markdown;
      }
    };

    const out = await pdfToMarkdown(pdfPath, u8, opts);

    // Certaines implémentations renvoient une string, d'autres { markdown, ... }
    const markdown = typeof out === 'string'
      ? out
      : (typeof out?.markdown === 'string' ? out.markdown : '');

    if (!markdown) throw new Error('pdfToMarkdown returned empty markdown');
    return markdown;
  };

  try {
    const md = await call("auto");
    pdfCache.set(cacheKey, md);
    return md;
  } catch (e) {
    console.error('  ❌ pdfToMarkdown a échoué :', e?.message || e);
    return { error: String(e?.message || e) };
  }
}

async function getCachedMarkdown(pdfUrl, dateLabel, docType) {
  // 1) archive officielle (inchangé)
  const officialPdfPath = await getArchivedPdfPath(pdfUrl, dateLabel, docType);

  // 2) fabriquer/récupérer la copie searchable (cache dans public/docs/conseil)
  const searchablePdfPath = await ensureSearchablePdf(officialPdfPath);

  // 3) chemin du .md (vous pouvez garder "conseils" si vous préférez)
  const mdFilePath = path.join(process.cwd(), 'public', 'docs', 'conseils',
    `${path.basename(searchablePdfPath, '.pdf')}.md`);

  if (mdCache[mdFilePath]) return mdCache[mdFilePath];

  try {
    await fs.access(mdFilePath);
    const cachedMd = await fs.readFile(mdFilePath, 'utf8');
    mdCache[mdFilePath] = cachedMd;
    return cachedMd;
  } catch {}

  // 4) conversion en Markdown depuis le PDF searchable
  let markdownContent = '';
  if (USE_MARKITDOWN) {
    // MarkItDown
    const [cmd, ...pre] = pythonLauncher();
    const tmpDir  = await fs.mkdtemp(path.join(os.tmpdir(), 'markit-'));
    const outPath = path.join(tmpDir, `${path.basename(searchablePdfPath, '.pdf')}.md`);
    try {
      const { stderr } = await execFileP(cmd, [...pre, '-m', 'markitdown', searchablePdfPath, '-o', outPath], { windowsHide: true });
      if (stderr?.trim()) console.warn(stderr.trim());
      markdownContent = await fs.readFile(outPath, 'utf8');
    } catch (e) {
      const msg = (e?.stderr?.toString?.() || e?.message || String(e)).trim();
      console.error('  ❌ markitdown a échoué :', msg);
      return { error: msg };
    } finally {
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
    }
  } else {
    // Votre pipeline JS
    try {
      const u8 = new Uint8Array(await fs.readFile(searchablePdfPath));
      const out = await convertPdfToMarkdown(u8, {
        ocrImages: false, // devenu inutile, le PDF est déjà searchable
        aiRefiner: options?.aiRefiner || null
      });
      markdownContent = typeof out === 'string' ? out : (out?.markdown || '');
    } catch (e) {
      return { error: e?.message || String(e) };
    }
  }

  await fs.mkdir(path.dirname(mdFilePath), { recursive: true });
  await fs.writeFile(mdFilePath, markdownContent, 'utf8');
  mdCache[mdFilePath] = markdownContent;
  return markdownContent;
}

// ---------- Données ----------
const BASE = 'https://www.mairie-corte.fr/';
const ODJ = [
  { date:'2025-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1910' },
  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1912' },
  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1913' },
  { date:'2025-03-18', href:'modules.php?name=Downloads&d_op=getit&lid=1914' },
  { date:'2024-12-23', href:'modules.php?name=Downloads&d_op=getit&lid=1915' },
  { date:'2024-12-16', href:'modules.php?name=Downloads&d_op=getit&lid=1916' },
  { date:'2024-12-09', href:'modules.php?name=Downloads&d_op=getit&lid=1917' },
  { date:'2024-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1772' },
  { date:'2024-09-23', href:'modules.php?name=Downloads&d_op=getit&lid=1751' },
  { date:'2024-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1753' },
  { date:'2024-04-22', href:'modules.php?name=Downloads&d_op=getit&lid=1717' },
  { date:'2024-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1718' },
  { date:'2024-03-25', href:'modules.php?name=Downloads&d_op=getit&lid=1719' },
  { date:'2024-02-12', href:'modules.php?name=Downloads&d_op=getit&lid=1642' },
  { date:'2023-11-20', href:'modules.php?name=Downloads&d_op=getit&lid=1615' },
  { date:'2023-10-30', href:'modules.php?name=Downloads&d_op=getit&lid=1592' },
  { date:'2023-07-24', href:'modules.php?name=Downloads&d_op=getit&lid=1596' },
  { date:'2023-04-11', href:'modules.php?name=Downloads&d_op=getit&lid=1597' },
  { date:'2023-03-20', href:'modules.php?name=Downloads&d_op=getit&lid=1600' },
  { date:'2023-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1599' },
];
const PV = [
  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1911' },
  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1920' },
  { date:'2024-12-23', href:'modules.php?name=Downloads&d_op=getit&lid=1923' },
  { date:'2024-12-16', href:'modules.php?name=Downloads&d_op=getit&lid=1924' },
  { date:'2024-12-09', href:'modules.php?name=Downloads&d_op=getit&lid=1918' },
  { date:'2024-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1928' },
  { date:'2024-09-23', href:'modules.php?name=Downloads&d_op=getit&lid=1771' },
  { date:'2024-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1752' },
  { date:'2024-04-22', href:'modules.php?name=Downloads&d_op=getit&lid=1714' },
  { date:'2024-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1713' },
  { date:'2024-03-25', href:'modules.php?name=Downloads&d_op=getit&lid=1715' },
  { date:'2024-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1712' },
  { date:'2023-11-20', href:'modules.php?name=Downloads&d_op=getit&lid=1716' },
  { date:'2023-10-30', href:'modules.php?name=Downloads&d_op=getit&lid=1617' },
  { date:'2023-07-24', href:'modules.php?name=Downloads&d_op=getit&lid=1604' },
  { date:'2023-04-11', href:'modules.php?name=Downloads&d_op=getit&lid=1594' },
  { date:'2023-03-20', href:'modules.php?name=Downloads&d_op=getit&lid=1593' },
  { date:'2023-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1598' },
];
const DELIB_LISTES = [
  { date:'2025-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1909' },
  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1919' },
  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1921' },
  { date:'2025-03-18', href:'modules.php?name=Downloads&d_op=getit&lid=1925' },
];

// ---------- Helpers ----------
function clean(s = '') { return s.replace(/\r/g,'').replace(/[ \t]+/g,' ').trim(); }
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(()=> '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => mdEscape(c)).join(' | ')} |`).join('\n');
  return `${head}\n${body}\n`;
}
function sstr(x) { return (typeof x === 'string') ? x : String(x ?? ''); }
function mdEscape(s=''){ return sstr(s).replace(/\|/g,'\\|'); }


// ---------- LLM: canonisation ----------
async function canonizeItems(rawText, kind) {
  if (typeof rawText !== 'string') {
    console.warn(`  ⚠ ${kind}: entrée non textuelle, canonisation sautée`);
    return [];
  }
  const cleanText = clean(rawText);
  const chars = cleanText.replace(/\s+/g,'').length;

  if (chars < 50) {
    console.log(`  ⚠ Texte insuffisant pour ${kind}: ${chars} chars`);
    return [];
  }

  console.log(`  🤖 Canonisation ${kind} (${chars} chars) via ${CANON_MODEL}…`);

  const schema = {
  type: "json_schema",
  json_schema: {
    name: "CanonItems",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              order:    { type: "integer" },
              raw:      { type: "string" },
              title:    { type: "string" },
              topic:    { type: "string" },
              action:   { type: "string" },
              domain:   { type: "string" },
              keywords: { type: "array", items: { type: "string" } }
            },
            // >>> TOUS les champs listés dans 'properties' doivent être requis
            required: ["order","raw","title","topic","action","domain","keywords"],
            additionalProperties: false
          }
        }
      },
      required: ["items"],
      additionalProperties: false
    },
    strict: true
  }
};


  try {
    const resp = await client.chat.completions.create({
      model: CANON_MODEL,
      response_format: schema,
      messages: [
        { role: 'system', content:
`Vous extrayez les items d'un ODJ, PV ou liste de délibérations d’un conseil municipal français.
TÂCHE :
1) Identifier tous les points
2) Pour chaque point, fournir :
   - order (1..N)
   - raw
   - title
   - topic
   - action
   - domain
   - keywords (3 à 8)
CONTRAINTES :
- Conserver l’ordre
- Numéroter si absent
- JSON strict selon le schéma` },
        { role: 'user', content: cleanText.slice(0, 15000) }
      ],
      temperature: 0.1
    });

    const content = resp.choices?.[0]?.message?.content || '{"items":[]}';
    let out;
    try { out = JSON.parse(content); }
    catch { out = { items: [] }; }

    const items = Array.isArray(out.items)
      ? out.items.map((it, i) => ({
          order:    Number.isInteger(it.order) ? it.order : (i + 1),
          title:    clean(it.title || ''),
          topic:    clean(it.topic || ''),
          action:   clean(it.action || ''),
          domain:   clean(it.domain || ''),
          raw:      clean(it.raw || ''),
          keywords: Array.isArray(it.keywords) ? it.keywords.slice(0, 8).map(clean) : []
        }))
      : [];

    console.log(`  ✅ ${items.length} items extraits`);
    if (items.length) console.log(`     Ex: "${items[0].title.slice(0, 50)}..."`);
    return items;
  } catch (e) {
    console.error(`  ❌ Erreur canonisation ${kind}:`, e.message);
    return [];
  }
}

// ---------- Embeddings ----------
async function embedMany(arr) {
  if (!arr.length) return [];
  console.log(`  🔢 Embeddings (${arr.length}) via ${EMBED_MODEL}…`);
  const r = await client.embeddings.create({ model: EMBED_MODEL, input: arr });
  return r.data.map(d => d.embedding);
}

// ---------- Affectation hongroise (max sim) ----------
function hungarianMaxSim(simMatrix) {
  const n = simMatrix.length, m = simMatrix[0]?.length || 0;
  if (n === 0 || m === 0) return [];
  const N = Math.max(n, m);
  const cost = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => 1 - (simMatrix[i]?.[j] ?? 0))
  );
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (Number.isNaN(cost[i][j])) cost[i][j] = 1;

  const u = Array(N).fill(0), v = Array(N).fill(0), p = Array(N).fill(-1), way = Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(N).fill(Infinity);
    const used = Array(N).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let j1 = 0, delta = Infinity;
      for (let j = 1; j < N; j++) if (!used[j]) {
        const cur = cost[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j < N; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== -1);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assign = Array(n).fill(-1);
  for (let j = 1; j < N; j++) {
    const i = p[j];
    if (i >= 0 && i < n && j < m) assign[i] = j;
  }
  return assign;
}

// ---------- LLM: jugement des paires ----------
async function judgePairs(date, pairs) {
  if (!pairs.length) return [];
  console.log(`  ⚖️  Jugement de ${pairs.length} paires ambiguës via ${JUDGE_MODEL}…`);

  const schema = {
  type: "json_schema",
  json_schema: {
    name: "AgendaActsJudgement",
    schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              idx: { type: "integer" },
              status: { type: "string", enum: ["CORRESPONDANCE","ORDRE_MODIFIE","LIBELLE_DIVERGENT","PERIMETRE_MODIFIE"] },
              rationale: { type: "string" }
            },
            required: ["idx","status","rationale"],
            additionalProperties: false
          }
        }
      },
      required: ["results"],
      additionalProperties: false
    },
    strict: true
  }
};

  const input = pairs.map((p, i) => ({
    idx: i,
    odj_order: p.odj.order,
    act_order: p.act.order,
    odj_title: p.odj.title,
    act_title: p.act.title,
    odj_meta: { topic: p.odj.topic, action: p.odj.action, domain: p.odj.domain, keywords: p.odj.keywords },
    act_meta: { topic: p.act.topic, action: p.act.action, domain: p.act.domain, keywords: p.act.keywords }
  }));

  try {
    const resp = await client.chat.completions.create({
      model: JUDGE_MODEL,
      response_format: schema,
      messages: [
        { role: 'system', content:
`Vous comparez des points ODJ vs Actes (PV/Délibérations).
STATUTS :
- CORRESPONDANCE : même sujet, ordre identique
- ORDRE_MODIFIE   : même sujet, ordre différent
- LIBELLE_DIVERGENT : libellé différent, fond similaire
- PERIMETRE_MODIFIE : périmètre réellement étendu ou réduit
Retour JSON conforme au schéma.` },
        { role: 'user', content: `Séance du ${date}\n\n${JSON.stringify(input, null, 2)}` }
      ],
      temperature: 0.1
    });
    const content = resp.choices?.[0]?.message?.content || '{"results":[]}';
    const out = JSON.parse(content);
    console.log('  ✅ Jugement terminé');
    return out.results || [];
  } catch (e) {
    console.error('  ❌ Erreur jugement :', e.message);
    return [];
  }
}

// ---------- Pipeline par date ----------
async function processDate(date) {
  console.log(`\n${'='.repeat(60)}\n  Séance du ${date}\n${'='.repeat(60)}`);

  const odjX = ODJ.find(x => x.date === date);
  const pvX  = PV.find(x => x.date === date);
  const dlX  = DELIB_LISTES.find(x => x.date === date);

  const res = { date, sources: {}, findings: [] };
  if (!odjX) { console.log(`  ⚠ Pas d’ODJ pour ${date}`); return res; }

  const odjUrl  = absUrl(BASE, odjX.href);
  const odjText = await getCachedMarkdown(odjUrl, date, 'odj');
  res.sources.odj = { url: odjUrl, ok: (typeof odjText === 'string') && odjText.replace(/\s+/g,'').length >= 50 };
  res.sources.searchable_odj = { local: path.join(CONSEIL_DIR, path.basename(await getArchivedPdfPath(odjUrl, date, 'odj'))) };
  const odjItems = await canonizeItems(odjText, 'ODJ');

  let actUrl = null, actKind = null, actText = '', actItems = [];

  if (dlX) {
    console.log('\n  📋 Traitement DÉLIBÉRATIONS…');
    actUrl  = absUrl(BASE, dlX.href);
    actText = await getCachedMarkdown(actUrl, date, 'delib');
    actKind = 'DELIB';
    actItems = await canonizeItems(actText, 'DELIB');
  }
  if ((!actItems.length) && pvX) {
    console.log('\n  📋 Traitement PROCÈS-VERBAL…');
    actUrl  = absUrl(BASE, pvX.href);
    actText = await getCachedMarkdown(actUrl, date, 'pv');
    actKind = 'PV';
    actItems = await canonizeItems(actText, 'PV');
  }
  if (actUrl) res.sources[actKind.toLowerCase()] = { url: actUrl, ok: (typeof actText === 'string') && actText.replace(/\s+/g,'').length >= 50 };

  if (!odjItems.length || !actItems.length) {
    const msg = !odjItems.length ? 'ODJ vide' : 'Actes vides';
    console.log(`\n  ❌ ${msg} — comparaison impossible`);
    res.findings.push({ against: actKind || 'AUCUN', rows: [], note: `Sources insuffisantes (${msg})` });
    return res;
  }

  console.log(`\n  🔍 COMPARAISON : ${odjItems.length} ODJ ↔ ${actItems.length} ${actKind}`);

  const canonText = it => [it.title, it.topic, it.action, it.domain, (it.keywords || []).join(' ')].filter(Boolean).join(' | ');
  const O = odjItems.map(canonText);
  const A = actItems.map(canonText);
  const [eO, eA] = await Promise.all([embedMany(O), embedMany(A)]);

  const M = O.map((_, i) => A.map((__, j) => cosine(eO[i], eA[j])));
  const assign = hungarianMaxSim(M);

  const rows = [];
  const usedJ = new Set();
  const toJudge = [];

  assign.forEach((j, i) => {
    if (j === -1) {
      rows.push({ status: 'ABSENT_DANS_ACTES', odj_order: odjItems[i].order, act_order: '', similarity: '', odj_title: odjItems[i].title, act_title: '' });
      return;
    }
    usedJ.add(j);
    const sim = +M[i][j].toFixed(3);
    const match = { odj: odjItems[i], act: actItems[j], sim };

    if (sim < LOW_SIM) {
      rows.push({ status: 'ABSENT_DANS_ACTES', odj_order: match.odj.order, act_order: '', similarity: sim, odj_title: match.odj.title, act_title: '' });
      return;
    }
    if (sim >= HIGH_SIM) {
      const samePos = (match.odj.order === match.act.order);
      rows.push({
        status: samePos ? 'CORRESPONDANCE' : 'ORDRE_MODIFIE',
        odj_order: match.odj.order,
        act_order: match.act.order,
        similarity: sim,
        odj_title: match.odj.title,
        act_title: match.act.title
      });
      return;
    }
    toJudge.push({ i, j, odj: match.odj, act: match.act, sim });
  });

  for (let j = 0; j < actItems.length; j++) {
    if (!usedJ.has(j)) {
      rows.push({ status: 'AJOUT_HORS_ODJ', odj_order: '', act_order: actItems[j].order, similarity: '', odj_title: '', act_title: actItems[j].title });
    }
  }

  if (toJudge.length) {
    const judged = await judgePairs(date, toJudge.map(x => ({ odj: x.odj, act: x.act })));
    for (const j of judged) {
      const src = toJudge[j.idx];
      rows.push({
        status: j.status || 'LIBELLE_DIVERGENT',
        odj_order: src.odj.order,
        act_order: src.act.order,
        similarity: src.sim,
        odj_title: src.odj.title,
        act_title: src.act.title,
        rationale: j.rationale || ''
      });
    }
  }

  const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`\n  ✅ ${rows.length} lignes`);
  console.log(`     - Correspondances : ${summary.CORRESPONDANCE || 0}`);
  console.log(`     - Ordre modifié   : ${summary.ORDRE_MODIFIE || 0}`);
  console.log(`     - Libellé divergent : ${summary.LIBELLE_DIVERGENT || 0}`);
  console.log(`     - Périmètre modifié : ${summary.PERIMETRE_MODIFIE || 0}`);
  console.log(`     - Absents         : ${summary.ABSENT_DANS_ACTES || 0}`);
  console.log(`     - Ajouts          : ${summary.AJOUT_HORS_ODJ || 0}`);

  res.findings.push({ against: actKind || 'ACTES', rows });
  return res;
}

// ---------- Main ----------
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Audit ODJ ↔ Actes — Commune de Corte                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let dates = Array.from(new Set([
  ...ODJ.map(x => x.date),
  ...PV.map(x => x.date),
  ...DELIB_LISTES.map(x => x.date),
])).sort();

if (args.dates) {
  const only = new Set(String(args.dates).split(',').map(s => s.trim()));
  dates = dates.filter(d => only.has(d));
}
dates.reverse(); // plus récentes d’abord

console.log(`Traitement de ${dates.length} dates…`);

const reports = [];
for (const d of dates) {
  try {
    const R = await processDate(d);
    console.log(`✓ ${d}: ${R.findings?.[0]?.rows?.length || 0} lignes`);
    reports.push(R);
  } catch (e) {
    console.error(`✗ Erreur ${d}:`, e.message || e);
    reports.push({ date: d, error: String(e) });
  }
}

// Sorties
let md = `# Audit ODJ ↔ Actes (IA, précision maximale) — Commune de Corte\n\n`;
md += `Méthode : canonicalisation ${CANON_MODEL}, embeddings ${EMBED_MODEL}, affectation hongroise, jugement ${JUDGE_MODEL}.\n\n`;

const csvHeaders = ['date','contre','status','odj_order','act_order','similarity','odj_title','act_title','odj_url','act_url'];
const csv = [csvHeaders.join(',')];
const json = [];

for (const R of reports) {
  md += `## Séance ${R.date}\n`;
  if (R.error) { md += `Erreur: ${R.error}\n\n`; continue; }
  const src = [];
  if (R.sources?.odj)   src.push(`[ODJ](${R.sources.odj.url})`);
  if (R.sources?.delib) src.push(`[Délibérations](${R.sources.delib.url})`);
  if (R.sources?.pv)    src.push(`[PV](${R.sources.pv.url})`);
  md += `Sources: ${src.join(' · ') || '—'}\n\n`;

  for (const bloc of (R.findings || [])) {
    const rows = bloc.rows || [];
    const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    md += `### ODJ → ${bloc.against}\n`;
    md += `**Correspondance**: ${summary.CORRESPONDANCE||0} · **Ordre modifié**: ${summary.ORDRE_MODIFIE||0} · **Libellé divergent**: ${summary.LIBELLE_DIVERGENT||0} · **Périmètre modifié**: ${summary.PERIMETRE_MODIFIE||0} · **Absents**: ${summary.ABSENT_DANS_ACTES||0} · **Ajouts**: ${summary.AJOUT_HORS_ODJ||0}\n\n`;
    md += mdTable(['Statut','#ODJ','#Acte','Similarité','Libellé ODJ','Libellé Acte'],
      rows.map(r => [
        r.status,
        String(r.odj_order || ''),
        String(r.act_order || ''),
        String(r.similarity || ''),
        r.odj_title || '',
        r.act_title || ''
      ])
    );
    for (const r of rows) {
      csv.push([
        R.date, bloc.against, r.status,
        r.odj_order || '', r.act_order || '',
        r.similarity || '',
        `"${(r.odj_title || '').replace(/"/g,'""')}"`,
        `"${(r.act_title || '').replace(/"/g,'""')}"`,
        R.sources?.odj?.url || '',
        (bloc.against === 'PV' ? R.sources?.pv?.url : R.sources?.delib?.url) || ''
      ].join(','));
    }
    json.push({ date: R.date, against: bloc.against, rows, sources: R.sources });
  }
  md += '\n';
}

await fs.writeFile('rapport-odj-acts-ai.md', md, 'utf8');
await fs.writeFile('rapport-odj-acts-ai.csv', csv.join('\n'), 'utf8');
await fs.writeFile('rapport-odj-acts-ai.json', JSON.stringify(json, null, 2), 'utf8');

console.log('\n✓ Généré : rapport-odj-acts-ai.md, .csv, .json');
