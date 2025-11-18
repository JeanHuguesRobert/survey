import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import { linkifyWardWiki } from '../lib/wikiLinks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ShareModal from '../components/wiki/ShareModal';

export default function Wiki() {
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [editingPageId, setEditingPageId] = useState(null);
  const [formMode, setFormMode] = useState('view');
  const { slug: urlSlug } = useParams();
  const navigate = useNavigate();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Nouveaux états pour la navigation moderne
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('wiki-sort') || 'updated-desc');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('wiki-view') || 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('wiki-sidebar-width')) || 400);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (urlSlug) {
      loadPageBySlug(urlSlug);
    } else {
      setActivePage(null);
    }
  }, [urlSlug]);

  // Sauvegarder les préférences
  useEffect(() => {
    localStorage.setItem('wiki-sort', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('wiki-view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('wiki-sidebar-width', sidebarWidth.toString());
  }, [sidebarWidth]);

  async function loadPages() {
    const { data } = await supabase.from('wiki_pages').select('*').order('updated_at', { ascending: false });
    setPages(data || []);
  }

  async function loadPageBySlug(slug) {
    const { data } = await supabase.from('wiki_pages').select('*').eq('slug', slug).single();
    setActivePage(data || null);
  }

  const handleNewPage = () => navigate('/wiki/new');

  // Fonction de tri et filtrage
  const filteredAndSortedPages = useMemo(() => {
    let result = [...pages];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(page =>
        page.title.toLowerCase().includes(query) ||
        (page.content && page.content.toLowerCase().includes(query))
      );
    }

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'updated-desc':
          return new Date(b.updated_at) - new Date(a.updated_at);
        case 'updated-asc':
          return new Date(a.updated_at) - new Date(b.updated_at);
        case 'created-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'created-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        default:
          return 0;
      }
    });

    return result;
  }, [pages, searchQuery, sortBy]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (pages.length === 0) return null;
    const lastUpdate = pages.reduce((latest, page) => {
      const pageDate = new Date(page.updated_at);
      return pageDate > latest ? pageDate : latest;
    }, new Date(0));

    return {
      totalPages: pages.length,
      lastUpdate: lastUpdate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    };
  }, [pages]);

  function renderLink({ href, children }) {
    const isInternal = !href.startsWith('http') && !href.startsWith('//');
    if (isInternal) {
      const prefixedHref = `/wiki/${href.replace(/^\//, '')}`;
      return <Link to={prefixedHref} className="text-blue-600 hover:underline">{children}</Link>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>;
  }

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getContentPreview = (page) => {
    // Utiliser le summary s'il existe, sinon le contenu
    if (page.summary) return page.summary;
    if (!page.content) return 'Pas de contenu';
    const text = page.content.replace(/[#*\[\]()]/g, '').trim();
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  // Gestion du redimensionnement de la sidebar
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 240 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const isWelcomePage = !urlSlug;

  return (
    <div className="wiki-container flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        .wiki-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 100vw;
          overflow-x: hidden;
        }
        
        .page-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #e2e8f0;
        }
        
        .page-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
          border-color: #3b82f6;
        }
        
        .page-list-item {
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }
        
        .page-list-item:hover {
          background-color: #f8fafc;
          border-left-color: #3b82f6;
          transform: translateX(4px);
        }
        
        .search-input {
          transition: all 0.3s ease;
        }
        
        .search-input:focus {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .toolbar-button {
          transition: all 0.2s ease;
        }
        
        .toolbar-button:hover {
          background-color: #f1f5f9;
        }
        
        .toolbar-button.active {
          background-color: #3b82f6;
          color: white;
        }

        .fade-in {
          animation: fadeIn 0.4s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .resize-handle {
          position: absolute;
          top: 0;
          right: -4px;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          background: transparent;
          transition: background 0.2s;
          z-index: 10;
        }

        .resize-handle:hover {
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent);
        }

        .resize-handle.resizing {
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.8), transparent);
        }

        .content-preview {
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
          hyphens: auto;
        }
      `}</style>

      <div className="flex flex-col md:flex-row gap-0 flex-grow" style={{ maxWidth: '100vw', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          className="bg-white p-6 rounded-xl shadow-lg h-fit sticky top-6 flex-shrink-0 hidden md:block"
          style={{
            width: `${sidebarWidth}px`,
            minWidth: '240px',
            maxWidth: '600px',
            margin: '24px 0 24px 24px',
            position: 'relative'
          }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Wiki
            </h2>
            {stats && (
              <div className="text-sm space-y-1 text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{stats.totalPages} {stats.totalPages > 1 ? 'pages' : 'page'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Mis à jour le {stats.lastUpdate}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleNewPage}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle page
          </button>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Accès rapide
            </h3>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {pages.slice(0, 10).map(page => (
                <li key={page.id}>
                  <Link
                    to={`/wiki/${page.slug}`}
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 py-2 px-3 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate text-sm">{page.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resize Handle */}
          <div
            className={`resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleMouseDown}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6" style={{ padding: '24px', minWidth: 0, overflow: 'hidden' }}>
          {editMode ? (
            <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {formMode === 'edit' ? 'Modifier la page' : 'Créer une nouvelle page'}
              </h1>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Titre"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="Identifiant unique (ex : page-exemple)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={20}
                placeholder="Contenu de la page..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
              ></textarea>
              <div className="flex gap-4">
                <button
                  onClick={savePage}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setFormMode('view');
                    setEditingPageId(null);
                  }}
                  className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : activePage ? (
            <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
              <h1 className="text-3xl font-bold mb-6 text-gray-900">{activePage.title}</h1>
              {activePage.content && typeof activePage.content === 'string' ? (
                <div className="markdown-content prose prose-slate max-w-none">
                  <ErrorBoundary>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      breaks={true}
                      components={{ a: renderLink }}
                      skipHtml={true}
                    >
                      {linkifyWardWiki(activePage.content)}
                    </ReactMarkdown>
                  </ErrorBoundary>
                </div>
              ) : (
                <div className="text-gray-600">Le contenu de cette page est invalide ou vide.</div>
              )}
              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleShare}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Partager
                </button>
                <button
                  onClick={() => activePage && navigate(`/wiki/${activePage.slug}/edit`)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modifier
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 fade-in">
              {/* Toolbar */}
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  {/* Search */}
                  <div className="relative flex-1 w-full lg:max-w-md">
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher dans les pages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    {/* Sort Dropdown */}
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer font-medium text-sm"
                      >
                        <option value="updated-desc">📝 Dernière modification ↓</option>
                        <option value="updated-asc">📝 Dernière modification ↑</option>
                        <option value="title-asc">🔤 Titre A → Z</option>
                        <option value="title-desc">🔤 Titre Z → A</option>
                        <option value="created-desc">✨ Date de création ↓</option>
                        <option value="created-asc">✨ Date de création ↑</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`toolbar-button px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 ${viewMode === 'grid' ? 'active' : 'text-gray-600'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Grille
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`toolbar-button px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 ${viewMode === 'list' ? 'active' : 'text-gray-600'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        Liste
                      </button>
                    </div>
                  </div>
                </div>

                {searchQuery && (
                  <div className="mt-4 text-sm text-gray-600">
                    {filteredAndSortedPages.length} résultat{filteredAndSortedPages.length > 1 ? 's' : ''} trouvé{filteredAndSortedPages.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Pages Display */}
              {filteredAndSortedPages.length === 0 ? (
                <div className="bg-white p-12 rounded-xl shadow-lg text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-2">
                    {searchQuery ? 'Aucune page trouvée' : 'Aucune page pour le moment'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? 'Essayez avec d\'autres mots-clés' : 'Créez votre première page pour commencer'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedPages.map(page => (
                    <Link
                      key={page.id}
                      to={`/wiki/${page.slug}`}
                      className="page-card bg-white p-6 rounded-xl shadow-md hover:shadow-xl block"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg text-gray-900 truncate">
                            {page.title}
                          </h3>
                        </div>
                      </div>
                      <p className="content-preview text-sm text-gray-600 line-clamp-3 mb-4">
                        {getContentPreview(page)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(page.updated_at)}
                        </div>
                        <div className="text-blue-600 font-medium">
                          Voir →
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  {filteredAndSortedPages.map((page, index) => (
                    <Link
                      key={page.id}
                      to={`/wiki/${page.slug}`}
                      className={`page-list-item flex items-center gap-4 p-5 hover:bg-slate-50 ${index !== filteredAndSortedPages.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{page.title}</h3>
                        <p className="content-preview text-sm text-gray-600 truncate">{getContentPreview(page)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-500">{formatDate(page.updated_at)}</span>
                        <span className="text-xs text-blue-600 font-medium">Ouvrir →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto text-center p-6 bg-white border-t border-gray-200">
        <Link
          to={isWelcomePage ? "/" : "/wiki"}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {isWelcomePage ? "Retour à l'accueil général" : "Retour à la page d'accueil du Wiki"}
        </Link>
      </footer>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={window.location.href}
        shareTitle={activePage?.title || 'Wiki'}
      />
    </div>
  );
}
