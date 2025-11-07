import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { SECONDARY_COLOR } from '../constants';

function decodeBrowserPathname(pathname) {
  const rawSuffix = pathname && pathname.startsWith('/browser')
    ? pathname.slice('/browser'.length)
    : '';
  const trimmed = (rawSuffix || '').replace(/\/+$/, '');

  if (!trimmed) {
    return '/';
  }

  const decodedSegments = trimmed
    .split('/')
    .filter(Boolean)
    .map(segment => {
      try {
        return decodeURIComponent(segment);
      } catch (err) {
        console.warn('[PublicBrowser] unable to decode segment', segment, err);
        return segment;
      }
    });

  return `/${decodedSegments.join('/')}`;
}

function PublicBrowser() {
  const baseRoot = '/public/docs';
  const location = useLocation();
  const navigate = useNavigate();
  const [path, setPath] = useState(() => decodeBrowserPathname(location.pathname));
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [content, setContent] = useState('');
  const [backendMessage, setBackendMessage] = useState(null);
  const listRequestIdRef = useRef(0);
  const fileRequestIdRef = useRef(0);

  const fullPath = useMemo(() => {
    const p = path.replace(/^\/*/, '').replace(/\/*$/, '');
    return p ? `${baseRoot}/${p}` : baseRoot;
  }, [path]);

  useEffect(() => {
    const nextPath = decodeBrowserPathname(location.pathname);
    if (nextPath !== path) {
      setPath(nextPath);
    }
  }, [location.pathname, path]);

  useEffect(() => {
    const normalise = (value) => {
      if (!value) return '/';
      const trimmed = value.replace(/\/+$/, '');
      return trimmed || '/';
    };

    const segments = path.replace(/^\/+/, '').split('/').filter(Boolean);
    const encodedSuffix = segments.length
      ? `/${segments.map(part => encodeURIComponent(part)).join('/')}`
      : '';
    const target = `/browser${encodedSuffix}`;
    const current = normalise(location.pathname);
    const desired = normalise(target);

    if (current !== desired) {
      navigate(target, { replace: current.startsWith('/browser') });
    }
  }, [path, location.pathname, navigate]);

  useEffect(() => {
    const requestId = ++listRequestIdRef.current;
    let cancelled = false;

    async function listDir() {
      setLoading(true);
      setItems(null);
      setViewFile(null);
      setContent('');
      setBackendMessage(null);

      const rel0 = fullPath.replace(/^\//, '');
      const candidates = [];
      if (rel0.startsWith('public/')) {
        candidates.push(rel0.slice('public/'.length));
        candidates.push(rel0);
      } else {
        candidates.push(rel0);
        candidates.push(`public/${rel0}`);
      }
      candidates.push('docs');
      candidates.push('public/docs');
      const uniq = [...new Set(candidates.filter(Boolean))];

      let foundItems = null;
      let lastMessage = null;

      for (const c of uniq) {
        try {
          const apiPath = encodeURIComponent(c);
          const r = await fetch(`/.netlify/functions/public_browser?path=${apiPath}`);
          let json;
          try { json = await r.json(); } catch (e) { json = null; }
          if (Array.isArray(json)) {
            if (json.length) { foundItems = json; lastMessage = null; break; }
            lastMessage = null;
          } else if (json && Array.isArray(json.items)) {
            lastMessage = json.message || null;
            if (json.items.length) { foundItems = json.items; break; }
          } else if (r.ok && !json) {
            lastMessage = `Aucune réponse JSON pour path=${c}`;
          } else {
            const txt = await r.text().catch(() => null);
            lastMessage = txt || `HTTP ${r.status} for ${c}`;
          }
        } catch (err) {
          lastMessage = String(err.message || err);
        }
      }

      if (cancelled || listRequestIdRef.current !== requestId) {
        return;
      }

      if (foundItems) {
        setItems(foundItems);
        setBackendMessage(null);
      } else {
        setItems([]);
        setBackendMessage(lastMessage || `Pas de listing disponible pour ${fullPath}.`);
      }

      setLoading(false);
    }
    listDir();
    return () => {
      cancelled = true;
    };
  }, [fullPath]);

  async function openEntry(entry) {
    if (entry.isDir || entry.href.endsWith('/')) {
      const name = entry.name.replace(/\/$/, '');
      setPath(prev => (prev === '/' ? `/${name}` : `${prev}/${name}`));
      return;
    }

    const requestId = ++fileRequestIdRef.current;
    setLoading(true);
    setViewFile(entry);
    setContent('');
    try {
      let filePath = `${fullPath.replace(/^\//, '')}/${entry.name}`;
      if (filePath.startsWith('public/')) filePath = filePath.slice('public/'.length);
      const apiPath = encodeURIComponent(filePath);
      const r = await fetch(`/.netlify/functions/public_browser?path=${apiPath}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (fileRequestIdRef.current !== requestId) {
        return;
      }
      if (j?.file) {
        if (!j.base64) setContent(j.body || '');
        else {
          if (/^text\/|json|csv|markdown/.test(j.mime)) {
            const txt = atob(j.body);
            setContent(txt);
          } else {
            setContent(`Fichier binaire (${j.mime}). Utilisez le lien "Télécharger".`);
          }
        }
      } else {
        setContent('Contenu indisponible');
      }
    } catch (e) {
      if (fileRequestIdRef.current === requestId) {
        setContent(`Erreur de lecture: ${e.message}`);
      }
    } finally {
      if (fileRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  function goUp() {
    if (path === '/' || path === '') return;
    const parts = path.replace(/^\//, '').split('/');
    parts.pop();
    const np = parts.length ? `/${parts.join('/')}` : '/';
    setPath(np);
  }

  function renderFileContent(name, txt) {
    const ext = (name.split('.').pop() || '').toLowerCase();

    if (ext === 'md' || ext === 'markdown') {
      const rawHtml = marked.parse(txt || '');
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');
        doc.querySelectorAll('a').forEach(a => {
          if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
          if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
        });
        const sanitized = DOMPurify.sanitize(doc.body.innerHTML);
        return <div className="wiki-markdown prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      } catch (e) {
        const sanitized = DOMPurify.sanitize(rawHtml);
        return <div className="wiki-markdown prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      }
    }

    if (ext === 'json') {
      try { return <pre>{JSON.stringify(JSON.parse(txt || '{}'), null, 2)}</pre>; }
      catch { return <pre>{txt}</pre>; }
    }

    if (ext === 'csv') {
      const lines = (txt || '').trim().split(/\r?\n/).filter(Boolean);
      const rows = lines.map(l => l.split(','));
      return (
        <div className="browser-csv">
          <table>
            <thead>
              <tr>{(rows[0] || []).map((c, i) => (<th key={i}>{c}</th>))}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (<td key={ci}>{c}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <pre style={{ whiteSpace: 'pre-wrap' }}>{txt}</pre>;
  }

  function fileDownloadUrl(entry) {
    let filePath = `${fullPath.replace(/^\//, '')}/${entry.name}`;
    if (filePath.startsWith('public/')) filePath = filePath.slice('public/'.length);
    return `/.netlify/functions/public_browser?path=${encodeURIComponent(filePath)}&download=1`;
  }

  return (
    <div className="public-browser">
      <div className="browser-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2>Explorateur public (public/docs)</h2>
        <div>
          <button
            onClick={() => { setPath('/'); }}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 mr-2"
            aria-label="Aller à la racine"
          >
            Racine
          </button>
          <button
            onClick={goUp}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Remonter d'un niveau"
          >
            Remonter
          </button>
        </div>
      </div>

      <div className="browser-body" style={{ display: 'flex', gap: 20 }}>
        <div
          className="browser-list"
          style={{
            width: 480,
            minWidth: 360,
            maxWidth: 560,
            borderRight: '1px solid #eee',
            paddingRight: 12,
            boxSizing: 'border-box'
          }}
        >
          <p><strong>Chemin :</strong> {path}</p>
          {backendMessage && (
            <div className="mb-2 p-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-100 rounded">
              {backendMessage}
            </div>
          )}
          {loading && <p>Chargement...</p>}
          {!loading && items && items.length === 0 && !backendMessage && <p>Pas de listing disponible pour {fullPath}.</p>}
          {!loading && items && items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map((it, i) => {
                const displayName = it.name || it.href;
                return (
                  <li key={i} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      onClick={() => openEntry(it)}
                      className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100 w-full text-left"
                      style={{ gap: 8 }}
                    >
                      <span className="mr-2">{it.isDir ? '📁' : '📄'}</span>
                      <span
                        style={{
                          display: 'inline-block',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          whiteSpace: 'normal',
                          lineHeight: 1.2,
                          maxWidth: '100%'
                        }}
                      >
                        {displayName}
                      </span>
                    </button>
                    {!it.isDir && (
                      <a
                        href={fileDownloadUrl(it)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-3 inline-flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                        title="Télécharger le fichier"
                      >
                        ⬇
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="browser-view" style={{ flex: 1 }}>
          {viewFile ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ wordBreak: 'break-word' }}>{viewFile.name}</h3>
                <div>
                  <a
                    href={fileDownloadUrl(viewFile)}
                    download
                    className="px-3 py-1 rounded-md text-white"
                    style={{ backgroundColor: SECONDARY_COLOR, color: '#fff', textDecoration: 'none' }}
                  >
                    Télécharger
                  </a>
                </div>
              </div>
              {loading ? <p>Chargement du fichier...</p> : renderFileContent(viewFile.name, content)}
            </>
          ) : (
            <p>Sélectionnez un fichier à prévisualiser.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicBrowser;
