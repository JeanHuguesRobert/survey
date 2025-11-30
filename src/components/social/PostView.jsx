import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { isDeleted, getMetadata } from "../../lib/metadata";
import {
  getPostTitle,
  getPostType,
  getPostSubtitle,
  getPostSubtype,
  getPostEvent,
  getPostGroupId,
  getLinkedEntity,
  hasLinkedEntity,
  isPinned,
  isLocked,
  incrementViewCount,
  POST_TYPES,
} from "../../lib/socialMetadata";
import CommentThread from "./CommentThread";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FacebookEmbed from "../FacebookEmbed";
import { getDisplayName, getUserInitial } from "../../lib/userDisplay";
import SubscribeButton from "../common/SubscribeButton";
import EventInfo from "./EventInfo";

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
        .from("posts")
        .select("*, users(id, display_name, metadata)")
        .eq("id", id)
        .single();

      if (postError) throw postError;
      if (isDeleted(postData)) {
        throw new Error("Ce post a été supprimé");
      }

      setPost(postData);

      // Charger le groupe si le post appartient à un groupe
      const groupId = getPostGroupId(postData);
      if (groupId) {
        const { data: groupData } = await supabase
          .from("groups")
          .select("*")
          .eq("id", groupId)
          .single();

        if (groupData && !isDeleted(groupData)) {
          setGroup(groupData);
        }
      }

      // Charger l'entité liée si présente
      if (hasLinkedEntity(postData)) {
        const linked = getLinkedEntity(postData);
        if (linked.type === "wiki_page") {
          const { data } = await supabase
            .from("wiki_pages")
            .select("id, title")
            .eq("id", linked.id)
            .single();
          setLinkedEntity({ type: "wiki_page", data });
        } else if (linked.type === "proposition") {
          const { data } = await supabase
            .from("propositions")
            .select("id, title")
            .eq("id", linked.id)
            .single();
          setLinkedEntity({ type: "proposition", data });
        }
      }
    } catch (err) {
      console.error("Error loading post:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function trackView() {
    // Incrémenter le compteur de vues (sans attendre la réponse)
    try {
      const { data: currentPost } = await supabase
        .from("posts")
        .select("metadata")
        .eq("id", id)
        .single();

      if (currentPost) {
        const updated = incrementViewCount(currentPost);
        await supabase.from("posts").update({ metadata: updated.metadata }).eq("id", id);
      }
    } catch (err) {
      console.error("Error tracking view:", err);
    }
  }

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) return;

    try {
      const { error } = await supabase
        .from("posts")
        .update({
          metadata: {
            ...post.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser.id,
          },
        })
        .eq("id", id);

      if (error) throw error;

      alert("Post supprimé");
      navigate("/social");
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Erreur : " + err.message);
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
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
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
  const subtitle = getPostSubtitle(post);
  const subtype = getPostSubtype(post);
  const event = getPostEvent(post);
  const tags = getMetadata(post, "tags", []);
  const viewCount = getMetadata(post, "viewCount", 0);
  const isAuthor = currentUser?.id === post.user_id;

  const typeIcons = {
    [POST_TYPES.BLOG]: "📝",
    [POST_TYPES.FORUM]: "💬",
    [POST_TYPES.ANNOUNCEMENT]: "📢",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
        <Link to="/social" className="hover:underline">
          Social
        </Link>
        {group && (
          <>
            <span>›</span>
            <Link to={`/groups/${group.id}`} className="hover:underline">
              {group.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-gray-50">{title}</span>
      </div>

      {/* Gazette Banner */}
      {post.metadata?.gazette && (
        <div className="mb-6 p-4 bg-[#f4e4bc] text-[#2c241b] rounded border border-[#d4c49c] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📰</span>
            <div>
              <h3 className="font-serif font-bold text-lg leading-tight">Extra ! Extra !</h3>
              <p className="font-serif text-sm italic">Cet article est publié dans la Gazette.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 items-center">
              <Link
                to={
                  post.metadata.gazette === "global"
                    ? "/gazette"
                    : `/gazette/${post.metadata.gazette}`
                }
                className="px-4 py-2 bg-[#2c241b] text-[#f4e4bc] font-serif font-bold rounded hover:bg-opacity-90 transition-colors"
              >
                Lire dans la Gazette
              </Link>
              <Link
                to={`/posts/new?linkedType=post&linkedId=${encodeURIComponent(post.id)}${post.metadata.gazette ? `&gazette=${encodeURIComponent(post.metadata.gazette)}` : ""}${post.metadata.groupId ? `&groupId=${encodeURIComponent(post.metadata.groupId)}` : ""}`}
                className="px-4 py-2 bg-primary-600 text-bauhaus-white rounded hover:opacity-90 text-sm"
              >
                ✍️ Démarrer une discussion
              </Link>
            </div>
            <Link
              to={`/social?tab=posts&gazette=${encodeURIComponent(post.metadata.gazette)}&linkedType=post&linkedId=${post.id}${post.metadata.groupId ? `&groupId=${post.metadata.groupId}` : ``}`}
              className="px-4 py-2 bg-[#f4e4bc] text-[#2c241b] font-serif font-bold rounded border border-[#d4c49c] hover:bg-gray-100 transition-colors"
            >
              ☕ Discuter au Café
            </Link>
          </div>
        </div>
      )}

      {/* Post */}
      <article className=" rounded-lg shadow-sm p-8 mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              {getUserInitial(post.users)}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/users/${post.users?.id}`}
                  className="font-medium text-gray-50 hover:underline"
                >
                  {getDisplayName(post.users)}
                </Link>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-400">
                  {new Date(post.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
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

          <div className="flex items-start gap-3">
            {/* Subscribe Button */}
            <SubscribeButton contentType="post" contentId={post.id} currentUser={currentUser} />

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
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-gray-50 mb-4">{title}</h1>

        {/* Sous-titre si présent */}
        {subtitle && <h2 className="text-xl font-semibold text-gray-300 mb-4">{subtitle}</h2>}

        {/* Event info */}
        {subtype === "event" && <EventInfo event={event} />}

        {/* Entité liée */}
        {linkedEntity && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <span className="text-sm text-blue-800">
              🔗 Lié à{" "}
              <Link
                to={
                  linkedEntity.type === "wiki_page"
                    ? `/wiki/${linkedEntity.data.id}`
                    : `/propositions/${linkedEntity.data.id}`
                }
                className="font-medium hover:underline"
              >
                {linkedEntity.data.title}
              </Link>
            </span>
          </div>
        )}

        {/* Contenu (Markdown rendu) */}
        <div className="prose max-w-none mb-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content || ""}</ReactMarkdown>
        </div>

        {/* Facebook embed if post.metadata.sourceUrl is a Facebook URL */}
        {post.metadata?.sourceUrl && post.metadata.sourceUrl.includes("facebook.com") && (
          <div className="mb-6 flex justify-center">
            <FacebookEmbed url={post.metadata.sourceUrl} className="w-full" />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, idx) => (
              <Link
                key={idx}
                to={`/social?tab=posts&tag=${encodeURIComponent(tag)}`}
                className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400 pt-4 border-t">
          <span>
            👁️ {viewCount} vue{viewCount !== 1 ? "s" : ""}
          </span>
        </div>
      </article>

      {/* Commentaires */}
      {!locked ? (
        <CommentThread postId={id} currentUser={currentUser} />
      ) : (
        <div className="border border-gray-200 rounded p-4 text-center text-gray-400">
          🔒 Les commentaires sont désactivés sur ce post
        </div>
      )}
    </div>
  );
}
