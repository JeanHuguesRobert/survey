import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../lib/useCurrentUser";
import GroupList from "../components/social/GroupList";
import PostList from "../components/social/PostList";
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
              <PostList currentUserId={currentUser?.id} />
            </div>
          </div>
        )}

        {activeTab === "groups" && (
          <GroupList filterType={filterType} currentUserId={currentUser?.id} />
        )}

        {activeTab === "posts" && (
          <PostList postType={filterType} currentUserId={currentUser?.id} />
        )}
      </div>

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}
