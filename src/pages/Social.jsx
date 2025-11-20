import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../lib/useCurrentUser';
import GroupList from '../components/social/GroupList';
import PostList from '../components/social/PostList';
import { GROUP_TYPES, POST_TYPES } from '../lib/socialMetadata';
import SiteFooter from '../components/layout/SiteFooter';
import { MOVEMENT_NAME } from '../constants';

/**
 * Page principale Social - Vue d'ensemble groupes + posts
 */
export default function Social() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // all | groups | posts
  const [filterType, setFilterType] = useState(null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Café {MOVEMENT_NAME}
        </h1>
        <p className="text-gray-600">
          Forums, blogs, quartiers et associations de Corte
        </p>
      </div>

      {/* Actions */}
      {currentUser && (
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => navigate('/groups/new')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            + Créer un groupe
          </button>
          <button
            onClick={() => navigate('/posts/new')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            + Nouvelle publication
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'all'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tout
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'groups'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Groupes
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'posts'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Publications
          </button>
        </nav>
      </div>

      {/* Filters (conditional based on tab) */}
      {activeTab === 'groups' && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.NEIGHBORHOOD)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === GROUP_TYPES.NEIGHBORHOOD
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏘️ Quartiers
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.ASSOCIATION)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === GROUP_TYPES.ASSOCIATION
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🤝 Associations
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.FORUM)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === GROUP_TYPES.FORUM
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 Forums
            </button>
          </div>
        </div>
      )}

      {activeTab === 'posts' && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.BLOG)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === POST_TYPES.BLOG
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 Blogs
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.FORUM)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === POST_TYPES.FORUM
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 Discussions
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.ANNOUNCEMENT)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterType === POST_TYPES.ANNOUNCEMENT
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📢 Annonces
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
                <span>Groupes</span>
                <Link to="/social?tab=groups" className="text-sm text-primary-600 hover:underline font-normal">
                  Voir tout →
                </Link>
              </h2>
              <GroupList currentUserId={currentUser?.id} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
                <span>Publications récentes</span>
                <Link to="/social?tab=posts" className="text-sm text-primary-600 hover:underline font-normal">
                  Voir tout →
                </Link>
              </h2>
              <PostList currentUserId={currentUser?.id} />
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <GroupList filterType={filterType} currentUserId={currentUser?.id} />
        )}

        {activeTab === 'posts' && (
          <PostList postType={filterType} currentUserId={currentUser?.id} />
        )}
      </div>

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}
