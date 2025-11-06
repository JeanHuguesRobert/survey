// ESM, Node 20+
// Seule variable d'env lue : OPENAI_API_KEY (via .env ou process.env)

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import OpenAI from 'openai';
import os from 'node:os';
import { getDocumentProxy, extractText as unpdfExtractText } from 'unpdf';

if (!process.env.OPENAI_API_KEY) {
  console.error('Erreur: OPENAI_API_KEY manquant (.env ou variable env).');
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- CLI ----
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

// Modèles et seuils
const CANON_MODEL = String(args.canon_model || 'gpt-5');
const JUDGE_MODEL = String(args.judge_model || 'gpt-5');
const EMBED_MODEL = String(args.embed_model || 'text-embedding-3-large');
const LOW_SIM = 0.60;
const HIGH_SIM = 0.93;
const OCR_ENABLED = !Boolean(args.no_ocr);

// ---- Données ----
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

// ---- Utils HTTP ----
function absUrl(base, href) {
  try { return new URL(href, base).toString(); }
  catch { return `${base.replace(/\/+$/,'')}/${href.replace(/^\/+/,'')}`; }
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(url, { 
      headers: { 
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':'application/pdf,*/*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(new URL(res.headers.location, url).toString()));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// tesseract.js worker (lazy) — DO NOT pass non-clonable logger to worker (causes DataCloneError)
let _tessWorker = null;
async function getTesseractWorker() {
  if (_tessWorker) return _tessWorker;
  _tessWorker = createWorker(); // no logger here to avoid worker postMessage cloning errors
  try {
    await _tessWorker.load();
    // try combined languages, fallback to single
    try {
      await _tessWorker.loadLanguage('fra+eng');
      await _tessWorker.initialize('fra+eng');
    } catch {
      await _tessWorker.loadLanguage('fra');
      await _tessWorker.initialize('fra');
    }
  } catch (e) {
    console.warn('  ⚠ tesseract.js worker init failed:', e.message || e);
    try { await _tessWorker.terminate(); } catch(_) {}
    _tessWorker = null;
  }
  return _tessWorker;
}

// ---- Extraction PDF + OCR optionnel ----

// --- OCR Tesseract.js (robuste aux variations d'API) ---

let ocrWorker = null;

function normLangs(langs) {
  if (Array.isArray(langs)) return langs.filter(Boolean);
  return String(langs || 'fra')
    .split(/[+,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function getOcrWorker(langs = ['fra','eng']) {
  const arr = normLangs(langs);
  if (!ocrWorker) {
    ocrWorker = await createWorker({ logger: null });
    await ocrWorker.load();
  }

  // Charge les langues (tableau → OK pour v5)
  try {
    await ocrWorker.loadLanguage(arr);
  } catch {
    // Repli sur chaîne jointe si la version ne supporte pas array
    await ocrWorker.loadLanguage(arr.join('+'));
  }

  // Initialise les langues
  try {
    await ocrWorker.initialize(arr);
  } catch {
    await ocrWorker.initialize(arr.join('+'));
  }
  return ocrWorker;
}

async function ocrBuffer(buf, langs = ['fra','eng']) {
  const w = await getOcrWorker(langs);
  const { data } = await w.recognize(buf);
  return data?.text || '';
}

function toPureUint8Array(buf) {
  // Vue binaire sans prototype Buffer
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function fetchBytes(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const visited = new Set();
    function go(u, n) {
      if (n < 0) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https:') ? https : http;
      const req = lib.get(u, {
        headers: {
          'User-Agent': 'Audit-ODJ-Pro/1.0',
          'Accept': 'application/pdf,*/*;q=0.8',
          'Accept-Language': 'fr,en;q=0.9',
          'Referer': u
        }
      }, (res) => {
        // redirections
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, u).toString();
          if (visited.has(next)) return reject(new Error('Redirect loop'));
          visited.add(next);
          res.resume(); // vide le flux
          return go(next, n - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve(toPureUint8Array(buf)); // <- Uint8Array “pur”
        });
      });
      req.on('error', reject);
    }
    go(url, maxRedirects);
  });
}

// save downloaded PDF bytes into public/docs/officiel (robuste + fallback)
function savePdfArchive(bytesUint8, url, dateLabel = '', docType = '') {
  const makeOrigName = () => {
    let origName = 'document.pdf';
    try {
      const u = new URL(url);
      const baseName = path.basename(u.pathname) || origName;
      if (/modules\.php$/i.test(baseName)) {
        const lid = u.searchParams.get('lid') || '';
        const nameParam = u.searchParams.get('name') || '';
        if (nameParam && lid) origName = `${nameParam}-${lid}.pdf`;
        else if (nameParam) origName = `${nameParam}.pdf`;
        else if (lid) origName = `document-${lid}.pdf`;
        else origName = 'document.pdf';
      } else {
        origName = baseName;
      }
    } catch (_) { /* ignore */ }
    return origName;
  };

  const typeMap = { odj: 'convocation-odj', pv: 'proces-verbal', delib: 'deliberations', deliberation: 'deliberations' };
  const typeLabel = typeMap[(docType || '').toLowerCase()] || 'document';
  const datePart = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());
  const rawName = `mairie-corte_${typeLabel}_${datePart}_${makeOrigName()}`;
  const safeName = rawName.normalize('NFKD').replace(/[^\w.\-]/g, '_').replace(/_+/g, '_').toLowerCase();

  const primaryDir = path.join(process.cwd(), 'public', 'docs', 'officiel');
  const fallbackDir = path.join(process.cwd(), 'tmp', 'officiel');
  const systemTmpDir = path.join(os.tmpdir(), 'audit-odj-officiel');

  const tryWrite = (dir) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const outPath = path.join(dir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
      fs.writeFileSync(outPath, Buffer.from(bytesUint8));
      return outPath;
    } catch (err) {
      // return error to caller
      return { error: String(err.message || err) };
    }
  };

  // Try primary location
  const primaryResult = tryWrite(primaryDir);
  if (typeof primaryResult === 'string') {
    console.log(`  📁 Archive PDF sauvegardé (primary): ${path.relative(process.cwd(), primaryResult)}`);
    return primaryResult;
  }

  console.warn(`  ⚠ Impossible d'écrire dans ${primaryDir}: ${primaryResult.error}`);
  // Try fallback in repo tmp
  const fallbackResult = tryWrite(fallbackDir);
  if (typeof fallbackResult === 'string') {
    console.log(`  📁 Archive PDF sauvegardé (fallback tmp): ${path.relative(process.cwd(), fallbackResult)}`);
    return fallbackResult;
  }

  console.warn(`  ⚠ Impossible d'écrire dans ${fallbackDir}: ${fallbackResult.error}`);
  // Try system tmp
  const sysResult = tryWrite(systemTmpDir);
  if (typeof sysResult === 'string') {
    console.log(`  📁 Archive PDF sauvegardé (system tmp): ${sysResult}`);
    return sysResult;
  }

  // All failed — log and return null
  console.error('  ❌ Tous les emplacements d\'archive ont échoué :', {
    primary: primaryResult.error,
    fallback: fallbackResult.error,
    system: sysResult.error
  });
  return null;
}

// ---- Extraction PDF (sans OCR) ----
async function extractTextFromPdf(url, dateLabel = '', docType = '') {
  // 1) Télécharge
  const bytes = await fetchBytes(url);
  // Save archive (non bloquant)
  try { savePdfArchive(bytes, url, dateLabel, docType); } catch(_) {}
  // 2) Ouvre le PDF
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (e) {
    console.error('[UNPDF] getDocumentProxy error:', e?.message || e);
    return ''; // laissez l’OCR prendre le relais si activé
  }
  // 3) Essai 1 : extraction “mergePages”
  let text = '';
  try {
    const { text: t } = await unpdfExtractText(pdf, { mergePages: true });
    text = (t || '').trim();
  } catch (e) {
    console.warn('[UNPDF] extractText mergePages failed:', e?.message || e);
  }

  // 4) Essai 2 : fallback page par page si vide/pauvre
  if (!text || text.replace(/\s+/g, '').length < 50) {
    try {
      const pages = pdf.numPages;
      const parts = [];
      for (let p = 1; p <= pages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        parts.push(content.items.map(i => i.str).join(' '));
      }
      text = parts.join('\n').trim();
    } catch (e) {
      console.warn('[UNPDF] per-page fallback failed:', e?.message || e);
    }
  }

  // 5) Normalisation simple (ligatures, césures)
  if (text) {
    text = text
      .replace(/\u00AD/g, '')            // soft hyphen
      .replace(/-\s*\n/g, '')            // tiret de césure en fin de ligne
      .replace(/[ \t]+\n/g, '\n')        // espaces avant saut de ligne
      .replace(/\u00A0/g, ' ');          // espaces insécables
  }

  return text;
}

// ---- Helpers ----
function clean(s='') { return s.replace(/\r/g,'').replace(/[ \t]+/g,' ').trim(); }
function cosine(a,b){ 
  let dot=0,na=0,nb=0; 
  for(let i=0;i<a.length;i++){ 
    dot+=a[i]*b[i]; 
    na+=a[i]*a[i]; 
    nb+=b[i]*b[i]; 
  } 
  return dot/(Math.sqrt(na)*Math.sqrt(nb)); 
}

// ---- LLM: canonicalisation ----
async function canonizeItems(rawText, kind) {
  const cleanText = clean(rawText);
  const chars = cleanText.replace(/\s+/g,'').length;
  
  if (chars < 50) {
    console.log(`  ⚠ Texte insuffisant pour ${kind}: ${chars} chars`);
    return [];
  }
  
  console.log(`  🤖 Canonisation ${kind} (${chars} chars) avec ${CANON_MODEL}...`);
  
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
                order: { type: "integer" },
                raw: { type: "string" },
                title: { type: "string" },
                topic: { type: "string" },
                action: { type: "string" },
                domain: { type: "string" },
                keywords: { type: "array", items: { type: "string" } }
              },
              required: ["order","raw","title"],
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
        { role:'system', content:
          `Vous extrayez des items d'ordre du jour (ODJ) ou procès-verbal (PV) ou délibérations d'un conseil municipal français.

TÂCHE:
1) Identifiez TOUS les points/items dans le document
2) Pour chaque point, extrayez:
   - order: numéro d'ordre (1, 2, 3...)
   - raw: texte brut du point
   - title: titre concis et clair
   - topic: sujet principal
   - action: type d'action (délibération, information, vote...)
   - domain: domaine (finances, urbanisme, ressources humaines...)
   - keywords: 3-8 mots-clés pertinents

IMPORTANT:
- Listez TOUS les points, même brefs
- Gardez l'ordre d'apparition
- Si un point n'a pas de numéro explicite, numérotez séquentiellement
- Retournez un JSON valide selon le schéma` },
        { role:'user', content: cleanText.slice(0, 15000) }
      ],
      temperature: 0.1
    });
    
    const content = resp.choices[0].message.content;
    const out = JSON.parse(content || '{"items":[]}');
    const items = Array.isArray(out.items) ? out.items.map((it,i)=>({
      order: it.order ?? (i+1),
      title: clean(it.title||''),
      topic: clean(it.topic||''),
      action: clean(it.action||''),
      domain: clean(it.domain||''),
      raw: clean(it.raw||''),
      keywords: Array.isArray(it.keywords) ? it.keywords.slice(0,8).map(clean) : []
    })) : [];
    
    console.log(`  ✅ ${items.length} items extraits`);
    if (items.length > 0) {
      console.log(`     Exemple: "${items[0].title.slice(0,50)}..."`);
    }
    return items;
  } catch(e) {
    console.error(`  ❌ Erreur canonisation ${kind}:`, e.message);
    if (e.response?.data) {
      console.error(`     API error:`, JSON.stringify(e.response.data).slice(0,200));
    }
    return [];
  }
}

// ---- Embeddings ----
async function embedMany(arr) {
  if (!arr.length) return [];
  console.log(`  🔢 Calcul embeddings: ${arr.length} items...`);
  try {
    const r = await client.embeddings.create({ model: EMBED_MODEL, input: arr });
    console.log(`  ✅ Embeddings calculés`);
    return r.data.map(d => d.embedding);
  } catch(e) {
    console.error(`  ❌ Erreur embeddings:`, e.message);
    throw e;
  }
}

// ---- Affectation hongroise (max sim) ----
function hungarianMaxSim(simMatrix) {
  const n = simMatrix.length, m = simMatrix[0]?.length || 0;
  if (n === 0 || m === 0) return [];
  
  const N = Math.max(n,m);
  const cost = Array.from({length:N}, (_,i)=>
    Array.from({length:N}, (_,j)=> 1 - (simMatrix[i]?.[j] ?? 0))
  );
  for(let i=0;i<N;i++) for(let j=0;j<N;j++) if (Number.isNaN(cost[i][j])) cost[i][j]=1;

  const u = Array(N).fill(0), v = Array(N).fill(0), p = Array(N).fill(-1), way = Array(N).fill(-1);
  for(let i=0;i<N;i++){
    p[0] = i;
    let j0 = 0;
    const minv = Array(N).fill(Infinity);
    const used = Array(N).fill(false);
    do{
      used[j0] = true;
      const i0 = p[j0];
      let j1 = 0, delta = Infinity;
      for(let j=1;j<N;j++) if(!used[j]){
        const cur = cost[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for(let j=0;j<N;j++){
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== -1);
    do{
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assign = Array(n).fill(-1);
  for(let j=1;j<N;j++){
    const i = p[j];
    if (i>=0 && i<n && j<m) assign[i] = j;
  }
  return assign;
}

// ---- Judge LLM ----
async function judgePairs(date, pairs) {
  if (!pairs.length) return [];
  
  console.log(`  ⚖️  Jugement de ${pairs.length} paires ambiguës...`);
  
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
              required: ["idx","status"],
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
  
  const input = pairs.map((p,i)=>({
    idx: i,
    odj_order: p.odj.order,
    act_order: p.act.order,
    odj_title: p.odj.title,
    act_title: p.act.title,
    odj_meta: { topic:p.odj.topic, action:p.odj.action, domain:p.odj.domain, keywords:p.odj.keywords },
    act_meta: { topic:p.act.topic, action:p.act.action, domain:p.act.domain, keywords:p.act.keywords }
  }));
  
  try {
    const resp = await client.chat.completions.create({
      model: JUDGE_MODEL,
      response_format: schema,
      messages: [
        { role: "system", content:
          `Vous êtes un contrôleur de légalité qui compare les points d'ordre du jour (ODJ) aux actes officiels (PV/délibérations).

STATUTS:
- CORRESPONDANCE: même sujet, ordre identique, conforme
- ORDRE_MODIFIE: même sujet mais ordre changé dans les actes
- LIBELLE_DIVERGENT: formulation différente mais fond similaire
- PERIMETRE_MODIFIE: l'acte étend ou réduit significativement le périmètre annoncé dans l'ODJ

Analysez chaque paire et retournez un JSON conforme au schéma.` },
        { role: "user", content: `Séance du ${date}\n\nPaires à analyser:\n${JSON.stringify(input, null, 2)}` }
      ],
      temperature: 0.1
    });
    
    const content = resp.choices[0].message.content;
    const out = JSON.parse(content || '{"results":[]}');
    console.log(`  ✅ Jugement terminé`);
    return out.results || [];
  } catch(e) {
    console.error(`  ❌ Erreur jugement:`, e.message);
    return [];
  }
}

// ---- Pipeline ----
async function processDate(date) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Séance du ${date}`);
  console.log('='.repeat(60));
  
  const odjX = ODJ.find(x=>x.date===date);
  const pvX  = PV.find(x=>x.date===date);
  const dlX  = DELIB_LISTES.find(x=>x.date===date);

  const res = { date, sources:{}, findings:[] };
  if (!odjX) {
    console.log(`  ⚠ Pas d'ODJ pour ${date}`);
    return res;
  }

  const odjUrl = absUrl(BASE, odjX.href);
  const odjText = await extractTextFromPdf(odjUrl, date, 'odj');
  res.sources.odj = { url: odjUrl, ok: odjText.replace(/\s+/g,'').length>=50 };
  const odjItems = await canonizeItems(odjText, 'ODJ');

  let actUrl = null, actKind = null, actText = '', actItems = [];
  if (dlX) {
    console.log(`\n  📋 Traitement DÉLIBÉRATIONS...`);
    actUrl = absUrl(BASE, dlX.href);
    actText = await extractTextFromPdf(actUrl, date, 'delib');
    actKind = 'DELIB';
    actItems = await canonizeItems(actText, 'DELIB');
  }
  if ((!actItems.length) && pvX) {
    console.log(`\n  📋 Traitement PROCÈS-VERBAL...`);
    actUrl = absUrl(BASE, pvX.href);
    actText = await extractTextFromPdf(actUrl, date, 'pv');
    actKind = 'PV';
    actItems = await canonizeItems(actText, 'PV');
  }
  if (actUrl) res.sources[actKind.toLowerCase()] = { url: actUrl, ok: actText.replace(/\s+/g,'').length>=50 };

  if (!odjItems.length || !actItems.length) {
    const msg = !odjItems.length ? 'ODJ vide' : 'Actes vides';
    console.log(`\n  ❌ ${msg} - impossible de comparer`);
    res.findings.push({ against: actKind || 'AUCUN', rows: [], note:`Sources insuffisantes (${msg})` });
    return res;
  }

  console.log(`\n  🔍 COMPARAISON: ${odjItems.length} ODJ ↔ ${actItems.length} ${actKind}`);
  
  const canonText = it => [it.title, it.topic, it.action, it.domain, (it.keywords||[]).join(' ')].filter(Boolean).join(' | ');
  const O = odjItems.map(canonText);
  const A = actItems.map(canonText);
  const [eO, eA] = await Promise.all([embedMany(O), embedMany(A)]);
  const M = O.map((_,i)=> A.map((__,j)=> cosine(eO[i], eA[j])));
  const assign = hungarianMaxSim(M);

  const rows = [];
  const usedJ = new Set();
  const toJudge = [];
  
  assign.forEach((j, i) => {
    if (j === -1) {
      rows.push({ status:'ABSENT_DANS_ACTES', odj_order: odjItems[i].order, act_order:'', similarity:'', odj_title: odjItems[i].title, act_title:'' });
      return;
    }
    usedJ.add(j);
    const sim = +M[i][j].toFixed(3);
    const match = { odj: odjItems[i], act: actItems[j], sim };
    if (sim < LOW_SIM) {
      rows.push({ status:'ABSENT_DANS_ACTES', odj_order: match.odj.order, act_order:'', similarity: sim, odj_title: match.odj.title, act_title:'' });
      return;
    }
    if (sim >= HIGH_SIM) {
      const samePos = (match.odj.order === match.act.order);
      rows.push({ status: samePos ? 'CORRESPONDANCE':'ORDRE_MODIFIE',
                  odj_order: match.odj.order, act_order: match.act.order, similarity: sim,
                  odj_title: match.odj.title, act_title: match.act.title });
      return;
    }
    toJudge.push({ i, j, odj: match.odj, act: match.act, sim });
  });

  for (let j=0;j<actItems.length;j++){
    if (!usedJ.has(j)) {
      rows.push({ status:'AJOUT_HORS_ODJ', odj_order:'', act_order: actItems[j].order, similarity:'', odj_title:'', act_title: actItems[j].title });
    }
  }

  if (toJudge.length) {
    const judged = await judgePairs(date, toJudge.map(x=>({ odj:x.odj, act:x.act })));
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

  const summary = rows.reduce((acc,r)=>{ acc[r.status]=(acc[r.status]||0)+1; return acc; },{});
  console.log(`\n  ✅ RÉSULTAT: ${rows.length} lignes générées`);
  console.log(`     - Correspondances: ${summary.CORRESPONDANCE||0}`);
  console.log(`     - Ordre modifié: ${summary.ORDRE_MODIFIE||0}`);
  console.log(`     - Libellé divergent: ${summary.LIBELLE_DIVERGENT||0}`);
  console.log(`     - Périmètre modifié: ${summary.PERIMETRE_MODIFIE||0}`);
  console.log(`     - Absents: ${summary.ABSENT_DANS_ACTES||0}`);
  console.log(`     - Ajouts: ${summary.AJOUT_HORS_ODJ||0}`);
  
  res.findings.push({ against: actKind || 'ACTES', rows });
  return res;
}

// ---- Sorties ----
function mdEscape(s=''){ return String(s).replace(/\|/g,'\\|'); }
function mdTable(headers, rows){
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(()=> '---').join(' | ')} |`;
  const body = rows.map(r=>`| ${r.map(c=>mdEscape(c)).join(' | ')} |`).join('\n');
  return head + '\n' + body + '\n';
}

// ---- Main ----
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Audit ODJ ↔ Actes - Commune de Corte                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

let dates = Array.from(new Set([
  ...ODJ.map(x=>x.date),
  ...PV.map(x=>x.date),
  ...DELIB_LISTES.map(x=>x.date),
])).sort();

if (args.dates) {
  const only = new Set(String(args.dates).split(',').map(s=>s.trim()));
  dates = dates.filter(d => only.has(d));
  }
  dates.reverse(); // Inverser l'ordre pour commencer par les dates les plus récentes

  console.log(`Traitement de ${dates.length} dates...`);

const reports = [];
for (const d of dates) {
  try {
    const R = await processDate(d);
    console.log(`✓ ${d}: ${R.findings?.[0]?.rows?.length||0} lignes`);
    reports.push(R);
  } catch(e){
    console.error(`✗ Erreur ${d}:`, e.message || e);
    reports.push({ date:d, error:String(e) });
  }
}

let md = `# Audit ODJ ↔ Actes (IA, précision maximale) — Commune de Corte\n\n`;
md += `Méthode : canonicalisation ${CANON_MODEL}, embeddings ${EMBED_MODEL}, affectation hongroise, jugement ${JUDGE_MODEL}.\n\n`;

const csvHeaders = ['date','contre','status','odj_order','act_order','similarity','odj_title','act_title','odj_url','act_url'];
const csv = [csvHeaders.join(',')];
const json = [];

for (const R of reports) {
  md += `## Séance ${R.date}\n`;
  if (R.error){ md += `Erreur: ${R.error}\n\n`; continue; }
  const src = [];
  if (R.sources?.odj) src.push(`[ODJ](${R.sources.odj.url})`);
  if (R.sources?.delib) src.push(`[Délibérations](${R.sources.delib.url})`);
  if (R.sources?.pv) src.push(`[PV](${R.sources.pv.url})`);
  md += `Sources: ${src.join(' · ') || '—'}\n\n`;

  for (const bloc of (R.findings||[])) {
    const rows = bloc.rows || [];
    const summary = rows.reduce((acc,r)=>{ acc[r.status]=(acc[r.status]||0)+1; return acc; },{});
    md += `### ODJ → ${bloc.against}\n`;
    md += `**Correspondance**: ${summary.CORRESPONDANCE||0} · **Ordre modifié**: ${summary.ORDRE_MODIFIE||0} · **Libellé divergent**: ${summary.LIBELLE_DIVERGENT||0} · **Périmètre modifié**: ${summary.PERIMETRE_MODIFIE||0} · **Absents**: ${summary.ABSENT_DANS_ACTES||0} · **Ajouts**: ${summary.AJOUT_HORS_ODJ||0}\n\n`;
    md += mdTable(['Statut','#ODJ','#Acte','Similarité','Libellé ODJ','Libellé Acte'],
      rows.map(r=>[
        r.status, String(r.odj_order||''), String(r.act_order||''), String(r.similarity||''),
        r.odj_title||'', r.act_title||''
      ])
    );
    for (const r of rows) {
      csv.push([
        R.date, bloc.against, r.status,
        r.odj_order||'', r.act_order||'',
        r.similarity||'',
        `"${(r.odj_title||'').replace(/"/g,'""')}"`,
        `"${(r.act_title||'').replace(/"/g,'""')}"`,
        R.sources?.odj?.url || '',
        (bloc.against==='PV' ? R.sources?.pv?.url : R.sources?.delib?.url) || ''
      ].join(','));
    }
    json.push({ date:R.date, against:bloc.against, rows, sources:R.sources });
  }
  md += '\n';
}

fs.writeFileSync('rapport-odj-acts-ai.md', md, 'utf8');
fs.writeFileSync('rapport-odj-acts-ai.csv', csv.join('\n'), 'utf8');
fs.writeFileSync('rapport-odj-acts-ai.json', JSON.stringify(json, null, 2), 'utf8');

console.log('\n✓ Généré: rapport-odj-acts-ai.md, .csv, .json');

// Terminate tesseract worker if used
if (_tessWorker) {
  try {
    await _tessWorker.terminate();
    console.log('✓ tesseract worker terminated');
  } catch(e) { /* ignore */ }
}
