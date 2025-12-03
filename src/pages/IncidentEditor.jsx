import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { isDeleted } from "../lib/metadata";
import IncidentEditorForm from "../components/incidents/IncidentEditorForm";
import { enrichUserMetadata } from "../lib/userTransform";

export default function IncidentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userStatus } = useCurrentUser();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (userStatus !== "signed_in" || !currentUser) return;

    async function loadPost() {
      try {
        setLoading(true);
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select("*, users(id, display_name, metadata)")
          .eq("id", id)
          .single();
        if (postError) throw postError;
        if (isDeleted(postData)) throw new Error("Ce post a été supprimé");
        if (postData.users) postData.users = enrichUserMetadata(postData.users);
        // Permission: author or gazette editor
        if (postData.author_id !== currentUser.id) {
          const gaz = postData?.metadata?.gazette || null;
          // check membership
          const { data: group } = await supabase
            .from("groups")
            .select("id")
            .eq(
              "name",
              gaz === "global"
                ? import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette"
                : gaz
            )
            .single();
          if (!group) throw new Error("Vous n'êtes pas autorisé à modifier ce post");
          const { data: member } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", group.id)
            .eq("user_id", currentUser.id)
            .single();
          if (!member) throw new Error("Vous n'êtes pas autorisé à modifier ce post");
        }
        setPost(postData);
      } catch (err) {
        console.error("Error loading incident post:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [id, currentUser, userStatus]);

  if (userStatus === "signing_in") return <div className="py-12">Loading...</div>;
  if (userStatus === "signed_out" || !currentUser)
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        Vous devez être connecté pour modifier une publication
      </div>
    );

  if (loading) return <div className="py-12">Chargement...</div>;
  if (error)
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-4">{error}</div>
      </div>
    );

  return <IncidentEditorForm post={post} currentUser={currentUser} />;
}
