import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { createPostMetadata, POST_TYPES, LINKED_TYPES } from '../../lib/socialMetadata';

/**
 * Éditeur de post (nouveau ou édition)
 */
export default function PostEditor({ post = null, currentUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditing = !!post;

  // Récupérer groupId depuis URL si création depuis un groupe
  const groupIdFromUrl = searchParams.get('groupId');
  const linkedTypeFromUrl = searchParams.get('linkedType');
  const linkedIdFromUrl = searchParams.get('linkedId');

  const [formData, setFormData] = useState({
    title: post?.metadata?.title || '',
    content: post?.content || '',
    postType: post?.metadata?.postType || POST_TYPES.FORUM,
    groupId: post?.metadata?.groupId || groupIdFromUrl || '',
    linkedType: post?.metadata?.linkedType || linkedTypeFromUrl || '',
    linkedId: post?.metadata?.linkedId || linkedIdFromUrl || '',
    tags: post?.metadata?.tags?.join(', ') || '',
    isPinned: post?.metadata?.isPinned || false,
    isLocked: post?.metadata?.isLocked || false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      setError('Vous devez être connecté');
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Le titre et le contenu sont requis');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const metadata = createPostMetadata(formData.postType, formData.title, {
        groupId: formData.groupId || null,
        linkedType: formData.linkedType || null,
        linkedId: formData.linkedId || null,
        isPinned: formData.isPinned,
        isLocked: formData.isLocked,
        tags: tagsArray
      });

      if (isEditing) {
        // Update existing post
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            content: formData.content,
            metadata
          })
          .eq('id', post.id);

        if (updateError) throw updateError;

        alert('Post mis à jour !');
        navigate(`/posts/${post.id}`);
      } else {
        // Create new post
        const { data: newPost, error: insertError } = await supabase
          .from('posts')
          .insert({
            user_id: currentUser.id,
            content: formData.content,
            metadata
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Auto-subscribe to created post
        await supabase
          .from('content_subscriptions')
          .insert({
            user_id: currentUser.id,
            content_type: 'post',
            content_id: newPost.id
          });

        alert('Post créé !');

        // Rediriger vers le groupe si c'est un post de groupe
        if (formData.groupId) {
          navigate(`/groups/${formData.groupId}`);
        } else {
          navigate(`/posts/${newPost.id}`);
        }
      }
    } catch (err) {
      console.error('Error saving post:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? 'Modifier le post' : 'Nouvelle publication'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Type de post */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de publication
          </label>
          <select
            name="postType"
            value={formData.postType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value={POST_TYPES.FORUM}>Discussion (Forum)</option>
            <option value={POST_TYPES.BLOG}>Article (Blog)</option>
            <option value={POST_TYPES.ANNOUNCEMENT}>Annonce</option>
          </select>
        </div>

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Titre de votre publication..."
          />
        </div>

        {/* Contenu */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contenu *
          </label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
            placeholder="Écrivez votre message... (Markdown supporté)"
          />
          <p className="text-xs text-gray-500 mt-1">
            Vous pouvez utiliser Markdown pour formater votre texte
          </p>
        </div>

        {/* Lien vers entité existante (optionnel) */}
        {!groupIdFromUrl && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Lier à une page existante (optionnel)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type</label>
                <select
                  name="linkedType"
                  value={formData.linkedType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Aucun lien</option>
                  <option value={LINKED_TYPES.WIKI_PAGE}>Page Wiki</option>
                  <option value={LINKED_TYPES.PROPOSITION}>Proposition</option>
                  <option value={LINKED_TYPES.GROUP}>Groupe</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ID de l'entité</label>
                <input
                  type="text"
                  name="linkedId"
                  value={formData.linkedId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                  placeholder="UUID..."
                  disabled={!formData.linkedType}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (séparés par des virgules)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="démocratie, participation, environnement..."
          />
        </div>

        {/* Options modérateur */}
        {currentUser && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Options</h3>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPinned"
                checked={formData.isPinned}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">📌 Épingler ce post (en haut de liste)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isLocked"
                checked={formData.isLocked}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">🔒 Verrouiller (empêcher nouveaux commentaires)</span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
          >
            {loading ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Publier')}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
