import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../lib/supabase";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { linkifyWardWiki } from "../lib/wikiLinks";
import { marked } from "marked";
import DOMPurify from "dompurify";
import ShareModal from "../components/wiki/ShareModal";
import { formatDate, formatRelativeDate } from "../lib/formatDate";
import CommentSection from "../components/common/CommentSection";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getDisplayName } from "../lib/userDisplay";
import { useSyncOperation, useDataLoader } from "../lib/useStatusOperations";
import { canWrite } from "../lib/permissions";

// Component to display page metadata
function PageMetadata({ page, syncHistory }) {
  return (
    <div className="wiki-metadata">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {/* Creation Date */}
        <div className="wiki-metadata-item">
          <span className="wiki-metadata-label">📅 Créé le :</span>
          <span>
            {formatDate(page.created_at, false)}
            <span className="text-gray-500 ml-1">({formatRelativeDate(page.created_at)})</span>
          </span>
        </div>

        {/* Last Modified Date */}
        <div className="wiki-metadata-item">
          <span className="wiki-metadata-label">🔄 Modifié le :</span>
          <span>
            {formatDate(page.updated_at, false)}
            <span className="text-gray-500 ml-1">({formatRelativeDate(page.updated_at)})</span>
          </span>
        </div>

        {/* Author */}
        {page.author && (
          <div className="wiki-metadata-item">
            <span className="wiki-metadata-label">✍️ Auteur :</span>
            <span>{getDisplayName(page.author)}</span>
          </div>
        )}

        {/* GitHub Sync */}
        {syncHistory && syncHistory.length > 0 && (
          <div className="wiki-metadata-item">
            <span className="wiki-metadata-label">📦 Dernière archive GitHub :</span>
            <span>{formatDate(syncHistory[0].last_sync_date, false)}</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {page.summary && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-start gap-2">
            <span className="wiki-metadata-label">📝 Résumé</span>
            <p className="text-gray-300 italic border-l-4 border-highlight pl-3">{page.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ArchiveButton({ pageId, slug }) {
  const syncOperation = useSyncOperation(`Archiving wiki page: ${slug || pageId}`);

  const handleArchive = async () => {
    await syncOperation(async (updateProgress) => {
      updateProgress(10, "Preparing archive...");

      const body = pageId ? { pageId } : { slug };

      updateProgress(30, "Sending to GitHub...");

      const response = await fetch("/.netlify/functions/sync-wiki", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      updateProgress(70, "Processing response...");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Archive failed");
      }

      updateProgress(100, "Archive completed successfully");

      return data;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleArchive}
        disabled={false} // The status monitoring handles this
        className="btn btn-secondary-action  text-sm"
      >
        📦 Archiver
      </button>
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
  const [syncHistory, setSyncHistory] = useState([]); // État pour l'historique de synchronisation
  const { currentUser } = useCurrentUser(); // Hook pour l'utilisateur connecté
  const loadPages = useDataLoader();
  const loadPageData = useDataLoader();

  useEffect(() => {
    loadPages(async () => {
      const { data } = await supabase
        .from("wiki_pages")
        .select("*")
        .order("updated_at", { ascending: false });
      setPages(data || []);
      return data;
    }).catch(() => {
      // Error is handled by the status monitoring system
      setPages([]);
    });
  }, [loadPages]);

  useEffect(() => {
    loadPageData(async () => {
      // Fetch page data first
      const { data: pageData, error: pageError } = await supabase
        .from("wiki_pages")
        .select("*")
        .eq("slug", slug)
        .single();

      if (pageError) throw pageError;

      // Try to fetch author information separately if author_id exists
      if (pageData && pageData.author_id) {
        try {
          const { data: userData } = await supabase
            .from("users")
            .select("email")
            .eq("id", pageData.author_id)
            .single();

          if (userData) {
            pageData.author = userData;
          }
        } catch (authorError) {
          // If users table doesn't exist or error, try auth.users
          try {
            const { data: authData } = await supabase.auth.admin.getUserById(pageData.author_id);
            if (authData?.user) {
              pageData.author = { email: authData.user.email };
            }
          } catch {
            // Silently fail if we can't get author info
            console.log("Could not fetch author information");
          }
        }
      }

      setPage(pageData || null);

      // Fetch sync history if page exists
      if (pageData) {
        const { data: syncData } = await supabase
          .from("git_sync_log")
          .select("last_sync_date, commit_sha")
          .eq("page_id", pageData.id)
          .order("last_sync_date", { ascending: false })
          .limit(1);

        setSyncHistory(syncData || []);
      }

      return pageData;
    })
      .catch((err) => {
        console.error("Error fetching page data:", err);
        setPage(null);
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, loadPageData]);

  const { prev, next } = useMemo(() => {
    if (!page || pages.length === 0) return { prev: null, next: null };
    const index = pages.findIndex((p) => p.slug === page.slug);
    return {
      prev: index > 0 ? pages[index - 1] : null,
      next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
    };
  }, [page, pages]);

  const renderLink = ({ href, children }) => {
    const isInternal = href && !href.startsWith("http") && !href.startsWith("//");
    if (isInternal) {
      const prefixedHref = `/wiki/${href.replace(/^\//, "")}`;
      return (
        <Link to={prefixedHref} className="text-primary hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  };

  const handleShare = () => {
    setShowShareModal(true); // Ouvre le modal de partage
  };

  if (loading) {
    // Loading is now handled globally by the status monitoring system
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-100">Page introuvable</h1>
        <p className="text-gray-400 mb-6">
          Cette page n’existe pas encore. Vous pouvez la créer ou revenir à l’accueil du Wiki.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to={`/wiki/new/${slug}?slug=${encodeURIComponent(slug)}`}
            className="btn btn-primary uppercase"
          >
            Créer la page "{slug}"
          </Link>
          <Link to="/wiki" className="btn btn-secondary uppercase">
            Retour au Wiki
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="theme-card p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 font-brand  tracking-wide mb-2">
              {page.title}
            </h1>
            <p className="text-sm text-gray-500 mt-2">Adresse de la page : /wiki/{page.slug}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleShare} className="btn btn-secondary-action  text-sm">
              Partager
            </button>

            {currentUser && canWrite(currentUser) && (
              <>
                <button
                  onClick={() => navigate(`/posts/new?linkedType=wiki_page&linkedId=${page.id}`)}
                  className="btn btn-success  text-sm"
                  title="Créer une discussion sur cette page"
                >
                  💬 Discuter
                </button>

                <button
                  onClick={() => navigate(`/wiki/${page.slug}/edit`)}
                  className="btn btn-primary  g-highlight text-dark hover:bg-yellow-400 border-dark"
                >
                  Modifier
                </button>

                <ArchiveButton slug={page.slug} />
              </>
            )}
          </div>
        </header>

        {/* Page Metadata */}
        <PageMetadata page={page} syncHistory={syncHistory} />

        {page.content && typeof page.content === "string" ? (
          <div className="markdown-content prose prose-slate max-w-none">
            <ErrorBoundary>
              <ReactMarkdown remarkPlugins={[remarkGfm]} breaks components={{ a: renderLink }}>
                {linkifyWardWiki(page.content)}
              </ReactMarkdown>
            </ErrorBoundary>
          </div>
        ) : (
          <div className="text-gray-500">Le contenu de cette page est invalide ou vide.</div>
        )}
      </article>

      <footer className="mt-10 flex items-center justify-between">
        <button
          onClick={() => prev && navigate(`/wiki/${prev.slug}`)}
          disabled={!prev}
          className={`btn  text-sm ${
            prev
              ? "btn-secondary"
              : "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 shadow-none"
          }`}
        >
          ← {prev ? prev.title : "Aucune"}
        </button>
        <Link to="/wiki" className="btn btn-primary  text-sm">
          Retour au Wiki
        </Link>
        <button
          onClick={() => next && navigate(`/wiki/${next.slug}`)}
          disabled={!next}
          className={`btn  text-sm ${
            next
              ? "btn-secondary"
              : "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 shadow-none"
          }`}
        >
          {next ? next.title : "Aucune"} →
        </button>
      </footer>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        pageTitle={page?.title || "Page Wiki"}
        pageUrl={window.location.href}
        pageContent={page?.content || ""}
      />

      {/* Section de commentaires */}
      <CommentSection
        linkedType="wiki_page"
        linkedId={page.id}
        currentUser={currentUser}
        defaultExpanded={false}
      />
    </div>
  );
};

export default WikiPage;
