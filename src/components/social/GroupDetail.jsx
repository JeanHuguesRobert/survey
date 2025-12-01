// src/components/social/GroupDetail.jsx

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { isDeleted, getMetadata } from "../../lib/metadata";
import { getGroupType } from "../../lib/socialMetadata";
import CommentSection from "../common/CommentSection";
import SiteFooter from "../layout/SiteFooter";
import { getDisplayName, getUserInitials } from "../../lib/userDisplay";
import { enrichUserMetadata } from "../../lib/userTransform";
import { isAdmin, isAnonymous } from "../../lib/permissions";

/**
 * Page détail d'un groupe avec membres et posts
 */
export default function GroupDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [gazetteNames, setGazetteNames] = useState([]);

  useEffect(() => {
    if (id) {
      loadGroupData();
    }
  }, [id, currentUser]);

  async function loadGroupData() {
    try {
      setLoading(true);
      setError(null);

      // Charger le groupe
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      if (isDeleted(groupData)) {
        throw new Error("Ce groupe a été supprimé");
      }

      setGroup(groupData);

      // Charger les membres
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*, users(id, display_name, metadata)")
        .eq("group_id", id);

      if (membersError) throw membersError;

      // Enrich user metadata
      const enrichedMembers = (membersData || []).map((member) => ({
        ...member,
        users: enrichUserMetadata(member.users),
      }));
      setMembers(enrichedMembers);

      // Vérifier si user actuel est membre/admin
      if (currentUser) {
        const membership = membersData?.find((m) => m.user_id === currentUser.id);
        setIsMember(!!membership);
        // Members are admins by default
        setIsGroupAdmin(!!membership);
      }

      // Charger les posts du groupe
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*, users(id, display_name, metadata)")
        .eq("metadata->>groupId", id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (postsError) throw postsError;

      // Enrich user metadata and filter deleted posts
      const activePosts = (postsData || [])
        .filter((p) => !isDeleted(p))
        .map((post) => ({
          ...post,
          users: enrichUserMetadata(post.users),
        }));
      setPosts(activePosts);

      // Detect if this group acts as a Gazette editor
      try {
        const foundGazettes = [];
        const globalEditorName = import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette";

        if (groupData.name === globalEditorName) {
          foundGazettes.push("global");
        }

        // If there are posts with metadata.gazette equal to the group name,
        // then this group is the editor for that named gazette.
        const { data: gposts } = await supabase
          .from("posts")
          .select("id")
          .eq("metadata->>gazette", groupData.name)
          .limit(1);

        if (gposts && gposts.length > 0) {
          foundGazettes.push(groupData.name);
        }

        setGazetteNames(foundGazettes);
      } catch (err) {
        console.error("Error detecting gazette membership:", err);
      }
    } catch (err) {
      console.error("Error loading group:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup() {
    if (!currentUser || isAnonymous(currentUser)) {
      if (!currentUser) {
        alert("Vous devez être connecté pour rejoindre un groupe");
      } else {
        alert("Bloqué, contactez un administrateur");
      }
      return;
    }

    try {
      const { error } = await supabase.from("group_members").insert({
        group_id: id,
        user_id: currentUser.id,
        metadata: { schemaVersion: 1 },
      });

      if (error) throw error;

      loadGroupData();
    } catch (err) {
      console.error("Error joining group:", err);
      alert("Erreur lors de l'adhésion : " + err.message);
    }
  }

  async function handleLeaveGroup() {
    if (!confirm("Êtes-vous sûr de vouloir quitter ce groupe ?")) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      loadGroupData();
    } catch (err) {
      console.error("Error leaving group:", err);
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
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 ">{error}</div>
        <button
          onClick={() => navigate("/social")}
          className="mt-4 text-primary-600 hover:underline"
        >
          ← Retour aux groupes
        </button>
      </div>
    );
  }

  if (!group) return null;

  const groupType = getGroupType(group);
  const avatarUrl = getMetadata(group, "avatarUrl");
  const location = getMetadata(group, "location");
  const tags = getMetadata(group, "tags", []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="   shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt={group.name} className="w-24 h-24   object-cover" />
          ) : (
            <div className="w-24 h-24   bg-primary-100 flex items-center justify-center text-4xl">
              {groupType === "neighborhood" && "🏘️"}
              {groupType === "association" && "🤝"}
              {groupType === "community" && "👥"}
              {groupType === "forum" && "💬"}
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-50 mb-2">{group.name}</h1>

            {location && <p className="text-gray-300 mb-2">📍 {location}</p>}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag, idx) => (
                  <span key={idx} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 ">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {gazetteNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {gazetteNames.map((g) => (
                  <Link
                    key={g}
                    to={g === "global" ? "/gazette" : `/gazette/${g}`}
                    className="inline-block text-sm bg-primary-600 text-bauhaus-white px-3 py-1 hover:opacity-90"
                  >
                    {g === "global" ? "Consulter la Gazette" : `Gazette : ${g}`}
                  </Link>
                ))}
              </div>
            )}
            <div className="mb-3">
              <Link
                to={`/social?tab=posts&groupId=${id}`}
                className="text-sm underline hover:no-underline"
              >
                ☕ Discuter ce groupe au Café
              </Link>
            </div>

            <p className="text-gray-300 mb-4">{group.description}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {currentUser && !isMember && (
              <button
                onClick={handleJoinGroup}
                className="px-4 py-2 bg-primary-600 text-bauhaus-white hover:bg-primary-700"
              >
                Rejoindre
              </button>
            )}
            {isMember && !isGroupAdmin && (
              <button
                onClick={handleLeaveGroup}
                className="px-4 py-2 bg-gray-200 text-gray-200 hover:bg-gray-300"
              >
                Quitter
              </button>
            )}
            {isGroupAdmin && (
              <button
                onClick={() => navigate(`/groups/${id}/edit`)}
                className="px-4 py-2 bg-primary-600 text-bauhaus-white hover:bg-primary-700"
              >
                Gérer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Posts / Membres */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts */}
        <div className="lg:col-span-2">
          <div className="   shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Publications</h2>

            {isMember && (
              <button
                onClick={() => navigate(`/posts/new?groupId=${id}`)}
                className="w-full mb-4 px-4 py-2 bg-primary-600 text-bauhaus-white hover:bg-primary-700"
              >
                + Nouvelle publication
              </button>
            )}

            {posts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune publication pour l'instant</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <h3 className="font-semibold text-gray-50 mb-2">
                      {getMetadata(post, "title", "Sans titre")}
                    </h3>
                    <p className="text-gray-300 text-sm line-clamp-2 mb-2">{post.content}</p>
                    <div className="text-xs text-gray-400">
                      Par{" "}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/users/${post.users?.id}`);
                        }}
                        className="font-medium text-gray-200 hover:underline"
                      >
                        {getDisplayName(post.users)}
                      </button>{" "}
                      • {new Date(post.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Membres */}
        <div className="lg:col-span-1">
          <div className="   shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Membres</h2>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    {getUserInitials(member.users)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-50 truncate">
                      <Link to={`/users/${member.users?.id}`} className="hover:underline">
                        {getDisplayName(member.users)}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-400">
                      Depuis {new Date(member.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section de discussion sur le groupe */}
      <div className="mt-6">
        <CommentSection
          linkedType="group"
          linkedId={id}
          currentUser={currentUser}
          defaultExpanded={false}
        />
      </div>

      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}
