import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Pour supporter les extensions Markdown comme les tableaux
import { Link, useParams, useNavigate } from 'react-router-dom'; // Import des hooks pour gérer l'URL
import ErrorBoundary from '../components/ErrorBoundary'; // Import du composant ErrorBoundary

export default function Wiki() {
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [editingPageId, setEditingPageId] = useState(null);
  const [formMode, setFormMode] = useState('view'); // 'view' | 'create' | 'edit'
  const { slug: urlSlug } = useParams(); // Récupère le slug depuis l'URL
  const navigate = useNavigate(); // Pour naviguer entre les pages

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (urlSlug) {
      loadPageBySlug(urlSlug); // Charge la page correspondant au slug dans l'URL
    } else {
      setActivePage(null); // Si aucun slug, on est sur la page de bienvenue
    }
  }, [urlSlug]);

  async function loadPages() {
    const { data } = await supabase.from('wiki_pages').select('*').order('title');
    setPages(data || []);
  }

  async function loadPageBySlug(slug) {
    const { data } = await supabase.from('wiki_pages').select('*').eq('slug', slug).single();
    setActivePage(data || null);
  }

  const handleNewPage = () => navigate('/wiki/new');

  function renderLink({ href, children }) {
    // Vérifie si le lien est interne ou externe
    const isInternal = !href.startsWith('http') && !href.startsWith('//');
    if (isInternal) {
      const prefixedHref = `/wiki/${href.replace(/^\//, '')}`; // Ajoute le préfixe /wiki/ si nécessaire
      return <Link to={prefixedHref} className="text-blue-600 hover:underline">{children}</Link>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>;
  }

  const handleShare = async () => {
    const shareData = {
      title: activePage?.title || 'Wiki',
      text: `Découvrez la page "${activePage?.title}" sur le Wiki de la consultation citoyenne.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papier !');
      }
    } catch (err) {
      console.error('Erreur lors du partage :', err);
    }
  };

  const isWelcomePage = !urlSlug; // Détermine si on est sur la page de bienvenue
  return (
    <div className="wiki-container flex flex-col min-h-screen">
      <div className="flex flex-col md:flex-row gap-4 p-4 flex-grow">
        <aside className="bg-gray-100 p-4 rounded-md shadow-md w-full md:w-1/4">
          <h2 className="text-lg font-bold mb-4">Pages du Wiki</h2>
          <ul className="space-y-2">
            {pages.map(page => (
              <li key={page.id}>
                <Link to={`/wiki/${page.slug}`} className="text-blue-600 hover:underline">
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
          <button
            onClick={handleNewPage}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Nouvelle page
          </button>
        </aside>
        <main className="bg-white p-4 rounded-md shadow-md w-full md:w-3/4">
          {editMode ? (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">
                {formMode === 'edit' ? 'Modifier la page' : 'Créer une nouvelle page'}
              </h1>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Titre"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="Identifiant unique (ex : page-exemple)"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={20}
                placeholder="Contenu de la page..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
              <div className="flex gap-4">
                <button
                  onClick={savePage}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setFormMode('view');
                    setEditingPageId(null);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              {activePage ? (
                <div>
                  <h1 className="text-2xl font-bold mb-4">{activePage.title}</h1>
                  {activePage.content && typeof activePage.content === 'string' ? (
                    <div className="markdown-content">
                      <ErrorBoundary>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]} // Ajout de plugins pour Markdown
                          breaks={true} // Active les sauts de ligne simplesur Markdown
                          components={{ // Active les sauts de ligne simples
                            a: renderLink
                          }}
                          skipHtml={true} // Ignore les balises HTML non prises en charge
                        >
                          {activePage.content}
                        </ReactMarkdown>
                      </ErrorBoundary>
                    </div>
                  ) : (
                    <div className="text-gray-600">Le contenu de cette page est invalide ou vide.</div>
                  )}
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={handleShare}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Partager
                    </button>
                    <button
                      onClick={() => activePage && navigate(`/wiki/${activePage.slug}/edit`)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">Sélectionnez une page pour la voir ou l’éditer.</div>
              )}
            </div>
          )}
        </main>
      </div>
      {/* Footer général */}
      <footer className="mt-auto text-center p-4 bg-gray-100 border-t">
        <Link
          to={isWelcomePage ? "/" : "/wiki"}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
        >
          {isWelcomePage ? "Retour à l'accueil général" : "Retour à la page d'accueil du Wiki"}
        </Link>
      </footer>
    </div>
  );
}


