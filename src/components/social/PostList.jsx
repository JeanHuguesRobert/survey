import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { isDeleted } from "../../lib/metadata";
import { enrichUserMetadata } from "../../lib/userTransform";
import PostCard from "./PostCard";

/**
 * Liste de posts avec filtres
 */
export default function PostList({
  groupId = null,
  linkedType = null,
  linkedId = null,
  postType = null,
  tag = null,
  gazette = null,
  currentUserId = null,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPosts();
  }, [groupId, linkedType, linkedId, postType, tag, gazette]);

  async function loadPosts() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from("posts").select("*, users(id, display_name, metadata)");

      // Filtres
      if (groupId) {
        query = query.eq("metadata->>groupId", groupId);
      }
      if (linkedType) {
        query = query.eq("metadata->>linkedType", linkedType);
      }
      if (linkedId) {
        query = query.eq("metadata->>linkedId", linkedId);
      }
      if (postType) {
        query = query.eq("metadata->>postType", postType);
      }
      if (tag) {
        // Filter posts whose metadata.tags array contains the tag
        // Use Supabase 'contains' on the JSON column
        query = query.contains("metadata", { tags: [tag] });
      }
      if (gazette) {
        query = query.eq("metadata->>gazette", gazette);
      }

      // Tri: épinglés en premier, puis par date
      query = query.order("created_at", { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filtre soft delete et enrichit user metadata
      const activePosts = (data || [])
        .filter((p) => !isDeleted(p))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));

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
      console.error("Error loading posts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-card p-6 text-center border-red-500">
        <p className="text-red-500 font-bold">Erreur lors du chargement des posts</p>
        <p className="text-gray-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="theme-card p-12 text-center text-gray-500">
        <p className="text-lg mb-2 font-bold">Aucune publication pour l'instant</p>
        <p className="text-sm">Soyez le premier à publier !</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          gazette={gazette}
          showMarkdown={Boolean(gazette)}
        />
      ))}
    </div>
  );
}
