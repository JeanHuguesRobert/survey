import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isDeleted } from '../../lib/metadata';
import PostCard from './PostCard';

/**
 * Liste de posts avec filtres
 */
export default function PostList({ groupId = null, linkedType = null, linkedId = null, postType = null, currentUserId = null }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPosts();
  }, [groupId, linkedType, linkedId, postType]);

  async function loadPosts() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('posts')
        .select('*, users(id, email, display_name, metadata)');

      // Filtres
      if (groupId) {
        query = query.eq('metadata->>groupId', groupId);
      }
      if (linkedType) {
        query = query.eq('metadata->>linkedType', linkedType);
      }
      if (linkedId) {
        query = query.eq('metadata->>linkedId', linkedId);
      }
      if (postType) {
        query = query.eq('metadata->>postType', postType);
      }

      // Tri: épinglés en premier, puis par date
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filtre soft delete
      const activePosts = (data || []).filter(p => !isDeleted(p));

      // Tri manuel pour mettre les épinglés en premier
      const sorted = activePosts.sort((a, b) => {
        const aPinned = a.metadata?.isPinned || false;
        const bPinned = b.metadata?.isPinned || false;
        
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        
        // Si même statut épinglé, tri par date
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setPosts(sorted);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Erreur lors du chargement des posts : {error}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">Aucune publication pour l'instant</p>
        <p className="text-sm">Soyez le premier à publier !</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
