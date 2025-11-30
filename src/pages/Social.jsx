import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../lib/useCurrentUser";
import GroupList from "../components/social/GroupList";
import PostList from "../components/social/PostList";
import { supabase } from "../lib/supabase";
import { GROUP_TYPES, POST_TYPES } from "../lib/socialMetadata";
import { canWrite } from "../lib/permissions";
import SiteFooter from "../components/layout/SiteFooter";
import { MOVEMENT_NAME } from "../constants";

/**
 * Page principale Social - Vue d'ensemble groupes + posts
 */
export default function Social() {
  const { currentUser, userStatus } = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "all"); // all | groups | posts
  const [filterType, setFilterType] = useState(null);
  const gazetteParam = searchParams.get("gazette");
  const [gazettes, setGazettes] = useState([]);
  const [selectedGazette, setSelectedGazette] = useState(gazetteParam || "");
  const linkedTypeParam = searchParams.get("linkedType");
  const linkedIdParam = searchParams.get("linkedId");
  const groupIdParam = searchParams.get("groupId");
  const [contextTitle, setContextTitle] = useState(null);
  const [contextGroup, setContextGroup] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadContext() {
      try {
        if (linkedTypeParam === "post" && linkedIdParam) {
          const { data } = await supabase
            .from("posts")
            .select("id,title,metadata")
            .eq("id", linkedIdParam)
            .single();
          if (mounted && data) {
            setContextTitle(data.title || `Post ${data.id}`);
          }
        } else if (gazetteParam) {
          setContextTitle(`Gazette: ${gazetteParam}`);
        } else if (groupIdParam) {
          // Fetch group name
          const { data: group } = await supabase
            .from("groups")
            .select("id,name")
            .eq("id", groupIdParam)
            .single();
          setContextGroup(group);
        } else {
          setContextTitle(null);
        }
      } catch (err) {
        console.error("Error loading social context:", err);
        setContextTitle(null);
      }
    }
    loadContext();
    return () => {
      mounted = false;
    };
  }, [linkedTypeParam, linkedIdParam, gazetteParam, groupIdParam]);

  useEffect(() => {
    async function loadGazettes() {
      try {
        // Load gazette names from posts metadata
        const { data, error } = await supabase
          .from("posts")
          .select("metadata->>gazette as gazette")
          .not("metadata->>gazette", "is", null)
          .limit(1000);
        if (error) throw error;
        const names = Array.from(new Set((data || []).map((d) => d.gazette).filter(Boolean)));
        // Ensure 'global' is present if not already
        if (!names.includes("global")) names.unshift("global");
        setGazettes(names);
        // sensible default: if no gazette param and 'global' exists, select it by default
        if (!gazetteParam && names.includes("global")) {
          setSelectedGazette("global");
          const params = new URLSearchParams(searchParams);
          params.set("gazette", "global");
          setSearchParams(params);
        }
      } catch (err) {
        console.error("Error loading gazette names:", err);
      }
    }
    loadGazettes();
  }, []);

  useEffect(() => {
    setSelectedGazette(gazetteParam || "");
  }, [gazetteParam]);

  // Keep activeTab in sync with URL query param `tab`
  useEffect(() => {
    const tab = searchParams.get("tab") || "all";
    setActiveTab(tab);
  }, [searchParams]);

  function setTab(tab) {
    setActiveTab(tab);
    // update URL param without removing other params
    const params = new URLSearchParams(searchParams);
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    setSearchParams(params);
    // reset filters when switching tabs
    setFilterType(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-gray-100 mb-2 font-brand  tracking-tighter">
          Café {MOVEMENT_NAME}
        </h1>
        <p className="text-gray-400">Forums, blogs, quartiers et associations de Corte</p>
      </div>

      {/* Actions */}
      {userStatus === "signed_in" && currentUser && canWrite(currentUser) && (
        <div className="mb-6 flex gap-3">
          <button onClick={() => navigate("/groups/new")} className="btn btn-primary  text-sm">
            + Créer un groupe
          </button>
          <button onClick={() => navigate("/posts/new")} className="btn btn-success  text-sm">
            + Nouvelle publication
          </button>
        </div>
      )}

      {/* Gazette quick link (always visible) */}
      <div className="mb-6">
        <Link
          to={
            gazetteParam
              ? gazetteParam === "global"
                ? "/gazette"
                : `/gazette/${gazetteParam}`
              : "/gazette"
          }
          className="inline-block btn btn-ghost text-sm"
        >
          📰 La Gazette
        </Link>
        <select
          value={selectedGazette}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedGazette(value);
            const params = new URLSearchParams(searchParams);
            if (!value) {
              params.delete("gazette");
            } else {
              params.set("gazette", value);
            }
            setSearchParams(params);
            if (value) setTab("posts");
          }}
          className="ml-3 inline-block border rounded px-2 py-1"
        >
          <option value="">Toutes</option>
          {gazettes.map((g) => (
            <option key={g} value={g}>
              {g === "global" ? "LA GAZETTE (global)" : g}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <nav className="tabs-nav">
        <button
          onClick={() => setTab("all")}
          className={`tab-item ${activeTab === "all" ? "active" : ""}`}
        >
          Tout
        </button>
        <button
          onClick={() => setTab("groups")}
          className={`tab-item ${activeTab === "groups" ? "active" : ""}`}
        >
          Groupes
        </button>
        <button
          onClick={() => setTab("posts")}
          className={`tab-item ${activeTab === "posts" ? "active" : ""}`}
        >
          Publications
        </button>
      </nav>

      {/* Filters (conditional based on tab) */}
      {activeTab === "groups" && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`filter-chip ${filterType === null ? "active" : ""}`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.NEIGHBORHOOD)}
              className={`filter-chip filter-chip--blue ${filterType === GROUP_TYPES.NEIGHBORHOOD ? "active" : ""}`}
            >
              🏘️ Quartiers
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.ASSOCIATION)}
              className={`filter-chip filter-chip--yellow ${filterType === GROUP_TYPES.ASSOCIATION ? "active" : ""}`}
            >
              🤝 Associations
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.FORUM)}
              className={`filter-chip ${filterType === GROUP_TYPES.FORUM ? "active" : ""}`}
            >
              💬 Forums
            </button>
          </div>
        </div>
      )}

      {activeTab === "posts" && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`filter-chip ${filterType === null ? "active" : ""}`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.BLOG)}
              className={`filter-chip ${filterType === POST_TYPES.BLOG ? "active" : ""}`}
            >
              📝 Blogs
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.FORUM)}
              className={`filter-chip filter-chip--yellow ${filterType === POST_TYPES.FORUM ? "active" : ""}`}
            >
              💬 Discussions
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.ANNOUNCEMENT)}
              className={`filter-chip ${filterType === POST_TYPES.ANNOUNCEMENT ? "active" : ""}`}
            >
              📢 Annonces
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {contextTitle && (
        <div className="mb-6 theme-card p-4 text-sm">
          <strong>Contexte : </strong>{" "}
          {contextTitle || (contextGroup ? `Groupe: ${contextGroup.name}` : null)}
          {linkedTypeParam === "post" && linkedIdParam && (
            <Link className="ml-3 text-primary hover:underline" to={`/posts/${linkedIdParam}`}>
              Voir l'article
            </Link>
          )}
          {gazetteParam && (
            <Link
              className="ml-3 text-primary hover:underline"
              to={gazetteParam === "global" ? "/gazette" : `/gazette/${gazetteParam}`}
            >
              Voir la Gazette
            </Link>
          )}
          {groupIdParam && contextGroup && (
            <Link className="ml-3 text-primary hover:underline" to={`/groups/${groupIdParam}`}>
              Voir le groupe
            </Link>
          )}
        </div>
      )}
      <div>
        {activeTab === "all" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between text-gray-100">
                <span>Groupes</span>
                <Link
                  to="/social?tab=groups"
                  className="text-sm text-primary hover:underline font-normal"
                >
                  Voir tout →
                </Link>
              </h2>
              <GroupList currentUserId={currentUser?.id} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between text-gray-100">
                <span>Publications récentes</span>
                <Link
                  to="/social?tab=posts"
                  className="text-sm text-primary hover:underline font-normal"
                >
                  Voir tout →
                </Link>
              </h2>
              <PostList
                currentUserId={currentUser?.id}
                tag={searchParams.get("tag")}
                gazette={gazetteParam}
                linkedType={linkedTypeParam}
                linkedId={linkedIdParam}
                groupId={groupIdParam}
              />
            </div>
          </div>
        )}

        {activeTab === "groups" && (
          <GroupList filterType={filterType} currentUserId={currentUser?.id} />
        )}

        {activeTab === "posts" && (
          <PostList
            postType={filterType}
            currentUserId={currentUser?.id}
            tag={searchParams.get("tag")}
            gazette={gazetteParam}
            linkedType={linkedTypeParam}
            linkedId={linkedIdParam}
            groupId={groupIdParam}
          />
        )}
      </div>

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}
