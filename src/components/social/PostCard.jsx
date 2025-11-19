import { Link } from 'react-router-dom';
import { getMetadata } from '../../lib/metadata';
import { getPostTitle, getPostType, isPinned, isLocked, POST_TYPES } from '../../lib/socialMetadata';

/**
 * Carte d'affichage d'un post
 */
export default function PostCard({ post, currentUserId }) {
  const title = getPostTitle(post);
  const postType = getPostType(post);
  const pinned = isPinned(post);
  const locked = isLocked(post);
  const tags = getMetadata(post, 'tags', []);
  const viewCount = getMetadata(post, 'viewCount', 0);

  // Icônes par type
  const typeIcons = {
    [POST_TYPES.BLOG]: '📝',
    [POST_TYPES.FORUM]: '💬',
    [POST_TYPES.ANNOUNCEMENT]: '📢'
  };

  const typeLabels = {
    [POST_TYPES.BLOG]: 'Article',
    [POST_TYPES.FORUM]: 'Discussion',
    [POST_TYPES.ANNOUNCEMENT]: 'Annonce'
  };

  return (
    <Link
      to={`/posts/${post.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          {post.users?.email?.[0]?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {post.users?.email || 'Anonyme'}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">
              {new Date(post.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
              {typeIcons[postType]} {typeLabels[postType]}
            </span>
            {pinned && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded flex items-center gap-1">
                📌 Épinglé
              </span>
            )}
            {locked && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded flex items-center gap-1">
                🔒 Verrouillé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Titre */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Extrait du contenu */}
      <p className="text-gray-600 text-sm mb-3 line-clamp-3">
        {post.content}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 5).map((tag, idx) => (
            <span
              key={idx}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
            >
              #{tag}
            </span>
          ))}
          {tags.length > 5 && (
            <span className="text-xs text-gray-500">+{tags.length - 5}</span>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t">
        <span className="flex items-center gap-1">
          👁️ {viewCount} vue{viewCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          💬 {/* Nombre de comments sera ajouté plus tard */}
        </span>
      </div>
    </Link>
  );
}
