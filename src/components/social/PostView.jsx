import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { isDeleted, getMetadata } from '../../lib/metadata';
import { 
  getPostTitle, 
  getPostType, 
  getPostGroupId, 
  getLinkedEntity, 
  hasLinkedEntity,
  isPinned, 
  isLocked,
  incrementViewCount,
  POST_TYPES 
} from '../../lib/socialMetadata';
import CommentThread from './CommentThread';

/**
 * Vue détaillée d'un post avec commentaires
 */
export default function PostView({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [linkedEntity, setLinkedEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      loadPost();
      trackView();
    }
  }, [id]);

  async function loadPost() {
    try {
      setLoading(true);
      setError(null);

      // Charger le post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, users(id, email, metadata)')
        .eq('id', id)
        .single();

      if (postError) throw postError;
      if (isDeleted(postData)) {
        throw new Error('Ce post a été supprimé');
      }

      setPost(postData);

      // Charger le groupe si le post appartient à un groupe
      const groupId = getPostGroupId(postData);
      if (groupId) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single();
        
        if (groupData && !isDeleted(groupData)) {
          setGroup(groupData);
        }
      }

      // Charger l'entité liée si présente
      if (hasLinkedEntity(postData)) {
        const linked = getLinkedEntity(postData);
        if (linked.type === 'wiki_page') {
          const { data } = await supabase
            .from('wiki_pages')
            .select('id, title')
            .eq('id', linked.id)
            .single();
          setLinkedEntity({ type: 'wiki_page', data });
        } else if (linked.type === 'proposition') {
          const { data } = await supabase
            .from('propositions')
            .select('id, title')
            .eq('id', linked.id)
            .single();
          setLinkedEntity({ type: 'proposition', data });
        }
      }

    } catch (err) {
      console.error('Error loading post:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function trackView() {
    // Incrémenter le compteur de vues (sans attendre la réponse)
    try {
      const { data: currentPost } = await supabase
        .from('posts')
        .select('metadata')
        .eq('id', id)
        .single();

      if (currentPost) {
        const updated = incrementViewCount(currentPost);
        await supabase
          .from('posts')
          .update({ metadata: updated.metadata })
          .eq('id', id);
      }
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  }

  async function handleDelete() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          metadata: {
            ...post.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser.id
          }
        })
        .eq('id', id);

      if (error) throw error;

      alert('Post supprimé');
      navigate('/social');
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Erreur : ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-primary-600 hover:underline"
        >
          ← Retour
        </button>
      </div>
    );
  }

  if (!post) return null;

  const title = getPostTitle(post);
  const postType = getPostType(post);
  const pinned = isPinned(post);
  const locked = isLocked(post);
  const tags = getMetadata(post, 'tags', []);
  const viewCount = getMetadata(post, 'viewCount', 0);
  const isAuthor = currentUser?.id === post.user_id;

  const typeIcons = {
    [POST_TYPES.BLOG]: '📝',
    [POST_TYPES.FORUM]: '💬',
    [POST_TYPES.ANNOUNCEMENT]: '📢'
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
        <Link to="/social" className="hover:underline">Social</Link>
        {group && (
          <>
            <span>›</span>
            <Link to={`/groups/${group.id}`} className="hover:underline">
              {group.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-gray-900">{title}</span>
      </div>

      {/* Post */}
      <article className="bg-white rounded-lg shadow-sm p-8 mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              {post.users?.email?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-gray-900">
                  {post.users?.email || 'Anonyme'}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-500">
                  {new Date(post.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded flex items-center gap-1">
                  {typeIcons[postType]} {postType}
                </span>
                {pinned && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    📌 Épinglé
                  </span>
                )}
                {locked && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                    🔒 Verrouillé
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {isAuthor && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/posts/${id}/edit`)}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Modifier
              </button>
              <button
                onClick={handleDelete}
                className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {title}
        </h1>

        {/* Entité liée */}
        {linkedEntity && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <span className="text-sm text-blue-800">
              🔗 Lié à{' '}
              <Link 
                to={linkedEntity.type === 'wiki_page' ? `/wiki/${linkedEntity.data.id}` : `/propositions/${linkedEntity.data.id}`}
                className="font-medium hover:underline"
              >
                {linkedEntity.data.title}
              </Link>
            </span>
          </div>
        )}

        {/* Contenu */}
        <div className="prose max-w-none mb-6">
          <p className="whitespace-pre-wrap text-gray-700">
            {post.content}
          </p>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t">
          <span>👁️ {viewCount} vue{viewCount !== 1 ? 's' : ''}</span>
        </div>
      </article>

      {/* Commentaires */}
      {!locked ? (
        <CommentThread postId={id} currentUser={currentUser} />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center text-gray-500">
          🔒 Les commentaires sont désactivés sur ce post
        </div>
      )}
    </div>
  );
}
