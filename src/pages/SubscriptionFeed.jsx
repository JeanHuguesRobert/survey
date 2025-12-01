import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { isDeleted } from "../lib/metadata";
import { enrichUserMetadata } from "../lib/userTransform";
import SiteFooter from "../components/layout/SiteFooter";

const CONTENT_TYPE_LABELS = {
  post: { icon: "💬", label: "Post", color: "bg-orange-100 text-orange-700" },
  proposition: { icon: "💡", label: "Proposition", color: "bg-blue-100 text-blue-700" },
  wiki_page: { icon: "📄", label: "Wiki", color: "bg-green-100 text-green-700" },
};

export default function SubscriptionFeed() {
  const { currentUser, userStatus } = useCurrentUser();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, post, proposition, wiki_page

  useEffect(() => {
    if (userStatus === "signed_in" && currentUser) {
      loadFeed();
    }
  }, [currentUser, userStatus, filter]);

  async function loadFeed() {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // ...existing code...
      // Récupérer les abonnements de l'utilisateur
      let subscriptionsQuery = supabase
        .from("content_subscriptions")
        .select("content_type, content_id")
        .eq("user_id", currentUser.id);

      if (filter !== "all") {
        subscriptionsQuery = subscriptionsQuery.eq("content_type", filter);
      }

      const { data: subscriptions, error: subsError } = await subscriptionsQuery;
      if (subsError) throw subsError;

      if (!subscriptions || subscriptions.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      // Grouper par type de contenu
      const groupedSubs = subscriptions.reduce((acc, sub) => {
        if (!acc[sub.content_type]) acc[sub.content_type] = [];
        acc[sub.content_type].push(sub.content_id);
        return acc;
      }, {});

      // Charger les commentaires pour chaque type
      const allComments = [];

      // Posts
      if (groupedSubs.post?.length > 0) {
        const { data: postComments } = await supabase
          .from("comments")
          .select("*, users(id, display_name, metadata), posts!inner(id, metadata)")
          .in("post_id", groupedSubs.post)
          .order("created_at", { ascending: false })
          .limit(50);

        if (postComments) {
          allComments.push(
            ...postComments.map((c) => ({
              ...c,
              users: enrichUserMetadata(c.users),
              content_type: "post",
              content_id: c.post_id,
              content_title: c.posts?.metadata?.title || "Sans titre",
              content_link: `/posts/${c.post_id}`,
            }))
          );
        }
      }

      // Trier tous les commentaires par date
      allComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setComments(allComments.filter((c) => !isDeleted(c)));
    } catch (error) {
      console.error("Error loading subscription feed:", error);
    } finally {
      setLoading(false);
    }
  }

  if (userStatus === "signing_in" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="   shadow-md p-12 text-center max-w-md">
          <p className="text-gray-300 mb-4">Chargement de vos abonnements...</p>
        </div>
      </div>
    );
  }

  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="   shadow-md p-12 text-center max-w-md">
          <p className="text-gray-300 mb-4">Vous devez être connecté pour voir vos abonnements</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-900 text-bauhaus-white hover:bg-blue-800"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <header className=" shadow-sm border-b-4 border-blue-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-50">Mes abonnements</h1>
          <p className="text-gray-300 mt-2">
            Suivez les nouvelles discussions sur les contenus qui vous intéressent
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filtres */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-bauhaus-white"
                : " text-gray-200 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilter("post")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "post"
                ? "bg-orange-600 text-bauhaus-white"
                : " text-gray-200 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            💬 Posts
          </button>
          <button
            onClick={() => setFilter("proposition")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "proposition"
                ? "bg-blue-600 text-bauhaus-white"
                : " text-gray-200 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            💡 Propositions
          </button>
          <button
            onClick={() => setFilter("wiki_page")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "wiki_page"
                ? "bg-green-600 text-bauhaus-white"
                : " text-gray-200 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            📄 Wiki
          </button>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="   shadow-md p-12 text-center">
            <p className="text-gray-300 mb-4">
              {filter === "all"
                ? "Vous n'êtes abonné à aucun contenu pour le moment"
                : `Aucun abonnement de type "${CONTENT_TYPE_LABELS[filter]?.label}"`}
            </p>
            <Link
              to="/social"
              className="inline-block px-6 py-3 bg-blue-900 text-bauhaus-white hover:bg-blue-800"
            >
              Explorer les contenus
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const typeInfo = CONTENT_TYPE_LABELS[comment.content_type];
              return (
                <div
                  key={comment.id}
                  className="   shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  {/* En-tête */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <Link
                        to={comment.content_link}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {comment.content_title}
                      </Link>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Auteur */}
                  <div className="text-sm text-gray-300 mb-2">
                    <span className="font-medium">{comment.users?.display_name || "Anonyme"}</span>{" "}
                    a commenté :
                  </div>

                  {/* Contenu du commentaire */}
                  <p className="text-gray-100 line-clamp-3">{comment.content}</p>

                  {/* Lien vers le commentaire */}
                  <Link
                    to={`${comment.content_link}#comment-${comment.id}`}
                    className="inline-block mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Voir le commentaire →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
