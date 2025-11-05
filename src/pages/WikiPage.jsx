import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';
import ErrorBoundary from '../components/ErrorBoundary';
import { linkifyWardWiki } from '../lib/wikiLinks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ShareModal from '../components/wiki/ShareModal';

export function ArchiveButton({ pageId, slug }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleArchive = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const body = pageId ? { pageId } : { slug };
      
      const response = await fetch('/.netlify/functions/sync-wiki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: data.message === 'Already synced today' 
            ? '✅ Déjà archivé aujourd\'hui'
            : '✅ Page archivée sur GitHub !'
        });
      } else {
        setStatus({
          type: 'error',
          message: `❌ Erreur: ${data.error}`
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleArchive}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Archivage en cours...' : '📦 Archiver'}
      </button>

      {status && (
        <div className={`p-3 rounded ${
          status.type === 'success' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

const WikiPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState([]); // Déclaration de l'état 'pages'
  const [showShareModal, setShowShareModal] = useState(false); // Nouvel état pour le modal de partage

  useEffect(() => {
    supabase.from('wiki_pages').select('*').order('updated_at', { ascending: false }).then(({ data }) => setPages(data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('wiki_pages')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setPage(data || null);
        setLoading(false);
      });
  }, [slug]);

  const { prev, next } = useMemo(() => {
    if (!page || pages.length === 0) return { prev: null, next: null };
    const index = pages.findIndex(p => p.slug === page.slug);
    return {
      prev: index > 0 ? pages[index - 1] : null,
      next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null
    };
  }, [page, pages]);

  const renderLink = ({ href, children }) => {
    const isInternal = href && !href.startsWith('http') && !href.startsWith('//');
    if (isInternal) {
      const prefixedHref = `/wiki/${href.replace(/^\//, '')}`;
      return <Link to={prefixedHref} className="text-blue-600 hover:underline">{children}</Link>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>;
  }

  const handleShare = () => {
    setShowShareModal(true); // Ouvre le modal de partage
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Page introuvable</h1>
        <p className="text-gray-600 mb-6">
          Cette page n’existe pas encore. Vous pouvez la créer ou revenir à l’accueil du Wiki.
        </p>
        <div className="flex justify-center gap-4">
          <Link to={`/wiki/new/${slug}?slug=${encodeURIComponent(slug)}`} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Créer la page "{slug}"
          </Link>
          <Link to="/wiki" className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
            Retour au Wiki
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="bg-white rounded-lg shadow-md p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{page.title}</h1>
            <p className="text-sm text-gray-500 mt-2">Adresse de la page : /wiki/{page.slug}</p>
          </div>
          <div className="flex gap-3">
            
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Partager
            </button>
            
            <button
              onClick={() => navigate(`/wiki/${page.slug}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Modifier
            </button>

            <ArchiveButton slug={page.slug} />
          </div>
        </header>

        {page.content && typeof page.content === 'string' ? (
          <div className="markdown-content">
            <ErrorBoundary>
              <ReactMarkdown remarkPlugins={[remarkGfm]} breaks components={{ a: renderLink }}>
                {linkifyWardWiki(page.content)}
              </ReactMarkdown>
            </ErrorBoundary>
          </div>
        ) : (
          <div className="text-gray-600">Le contenu de cette page est invalide ou vide.</div>
        )}
      </article>

      <footer className="mt-10 flex items-center justify-between">
        <button
          onClick={() => prev && navigate(`/wiki/${prev.slug}`)}
          disabled={!prev}
          className={`px-4 py-2 rounded-md font-semibold ${
            prev ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          ← {prev ? prev.title : 'Aucune'}
        </button>
        <Link
          to="/wiki"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
        >
          Retour au Wiki
        </Link>
        <button
          onClick={() => next && navigate(`/wiki/${next.slug}`)}
          disabled={!next}
          className={`px-4 py-2 rounded-md font-semibold ${
            next ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {next ? next.title : 'Aucune'} →
        </button>
      </footer>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        pageTitle={page?.title || 'Page Wiki'}
        pageUrl={window.location.href}
        pageContent={page?.content || ''}
      />
    </div>
  );
};

export default WikiPage;
