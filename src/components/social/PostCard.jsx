import { Link } from "react-router-dom";
import { getMetadata } from "../../lib/metadata";
import {
  getPostTitle,
  getPostType,
  isPinned,
  isLocked,
  POST_TYPES,
} from "../../lib/socialMetadata";
import { getDisplayName, getUserInitial } from "../../lib/userDisplay";

/**
 * Carte d'affichage d'un post
 */
export default function PostCard({ post, currentUserId }) {
  const title = getPostTitle(post);
  const postType = getPostType(post);
  const pinned = isPinned(post);
  const locked = isLocked(post);
  const tags = getMetadata(post, "tags", []);
  const viewCount = getMetadata(post, "viewCount", 0);

  // Icônes par type
  const typeIcons = {
    [POST_TYPES.BLOG]: "📝",
    [POST_TYPES.FORUM]: "💬",
    [POST_TYPES.ANNOUNCEMENT]: "📢",
  };

  const typeLabels = {
    [POST_TYPES.BLOG]: "Article",
    [POST_TYPES.FORUM]: "Discussion",
    [POST_TYPES.ANNOUNCEMENT]: "Annonce",
  };

  return (
    <Link
      to={`/posts/${post.id}`}
      className="theme-card p-6 block hover:translate-y-[-4px] transition-transform"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-10 h-10 rounded-none border border-bauhaus-black bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-bauhaus-black">
          {getUserInitial(post.users)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-gray-800">{getDisplayName(post.users)}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              {new Date(post.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-gray-100 border border-gray-300 px-2 py-0.5 font-bold  flex items-center gap-1">
              {typeIcons[postType]} {typeLabels[postType]}
            </span>
            {pinned && (
              <span className="text-xs bg-bauhaus-yellow text-bauhaus-black border border-bauhaus-black px-2 py-0.5 font-bold  flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>{" "}
                Épinglé
              </span>
            )}
            {locked && (
              <span className="text-xs bg-bauhaus-red text-white border border-bauhaus-red px-2 py-0.5 font-bold  flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>{" "}
                Verrouillé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Titre */}
      <h3 className="text-xl font-bold text-gray-800 mb-2 font-bauhaus uppercase">{title}</h3>

      {/* Extrait du contenu */}
      <p className="text-gray-600 text-sm mb-3 line-clamp-3">{post.content}</p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 5).map((tag, idx) => (
            <span key={idx} className="filter-chip text-xs py-0 px-2 cursor-default">
              #{tag}
            </span>
          ))}
          {tags.length > 5 && (
            <span className="text-xs text-gray-400 font-bold">+{tags.length - 5}</span>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t border-gray-200 font-medium">
        <span className="flex items-center gap-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>{" "}
          {viewCount} vue{viewCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>{" "}
          {/* Nombre de comments sera ajouté plus tard */}
        </span>
      </div>
    </Link>
  );
}
