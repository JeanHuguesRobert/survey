import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';

/*
  Netlify Function (ESM) - public browser
  Query params:
    - path=docs/officiel or path=docs/officiel/file.pdf
    - download=1 to force raw download (binary served base64 if needed)
*/
const ROOT = path.join(process.cwd(), 'public');

const MIME = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  const q = event.queryStringParameters || {};
  const relRaw = String(q.path || '').replace(/^\/+/, ''); // e.g. "docs/officiel"
  const download = q.download === '1' || q.download === 'true';

  // resolve and protect against path traversal
  const target = path.normalize(path.join(ROOT, relRaw || ''));
  const resolvedRoot = path.resolve(ROOT);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    return jsonResponse(400, { error: 'Invalid path' });
  }

  try {
    const stat = await fs.stat(resolvedTarget);
    if (stat.isDirectory()) {
      const names = await fs.readdir(resolvedTarget, { withFileTypes: true });
      const items = names.map(d => {
        const isDir = d.isDirectory();
        // build href as posix path relative to root (frontend expects '/docs/...')
        const href = path.posix.join('/', relRaw || '', d.name) + (isDir ? '/' : '');
        return {
          name: d.name,
          href,
          isDir,
          size: isDir ? 0 : (fsSync.statSync(path.join(resolvedTarget, d.name)).size || 0)
        };
      }).sort((a,b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
      return jsonResponse(200, items);
    }

    if (stat.isFile()) {
      const ext = path.extname(resolvedTarget).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const buf = await fs.readFile(resolvedTarget);
      const isBinary = !/^text\/|\/json|\/csv|\/markdown|^image\//.test(mime) && mime !== 'text/plain; charset=utf-8';

      if (download) {
        const body = isBinary ? buf.toString('base64') : buf.toString('utf8');
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${path.basename(resolvedTarget)}"`
        };
        return {
          statusCode: 200,
          headers,
          body,
          isBase64Encoded: isBinary
        };
      }

      // Default: return JSON wrapper describing file and content (text or base64)
      const body = isBinary ? buf.toString('base64') : buf.toString('utf8');
      return jsonResponse(200, {
        file: true,
        name: path.basename(resolvedTarget),
        mime,
        base64: isBinary,
        body
      });
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (e) {
    if (e.code === 'ENOENT') return jsonResponse(404, { error: 'Not found' });
    return jsonResponse(500, { error: String(e.message || e) });
  }
}
