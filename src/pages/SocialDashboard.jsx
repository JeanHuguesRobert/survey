import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../lib/useCurrentUser';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SiteFooter from '../components/layout/SiteFooter';


export default function SocialDashboard() {
  const { currentUser, userStatus } = useCurrentUser();
  const [stats, setStats] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentComments, setRecentComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userStatus === 'signed_in' && currentUser) {
      loadSocialStats();
    }
  }, [currentUser, userStatus]);

  const loadSocialStats = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      // ...existing code...
      // Get posts created by user
      const { data: userPosts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get comments by user
      const { data: userComments, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          posts!inner(title)
        `)
        .eq('author_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Get likes received on user's posts
      const { data: postLikes, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', (userPosts || []).map(p => p.id));

      if (likesError) throw likesError;

      // Calculate statistics
      const totalPosts = userPosts?.length || 0;
      const totalComments = userComments?.length || 0;
      const totalLikesReceived = postLikes?.length || 0;

      // Get unique posts commented on
      const uniquePostsCommented = new Set(userComments?.map(c => c.post_id)).size;

      // Activity by month (last 6 months)
      const activityData = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthPosts = userPosts?.filter(p => {
          const postDate = new Date(p.created_at);
          return postDate >= monthStart && postDate <= monthEnd;
        }).length || 0;

        const monthComments = userComments?.filter(c => {
          const commentDate = new Date(c.created_at);
          return commentDate >= monthStart && commentDate <= monthEnd;
        }).length || 0;

        const monthName = monthStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

        activityData.push({
          month: monthName,
          posts: monthPosts,
          comments: monthComments
        });
      }

      // Most liked posts
      const likesByPost = {};
      postLikes?.forEach(like => {
        likesByPost[like.post_id] = (likesByPost[like.post_id] || 0) + 1;
      });

      const mostLikedPosts = (userPosts || [])
        .map(post => ({
          ...post,
          likes: likesByPost[post.id] || 0
        }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 5);

      setStats({
        totalPosts,
        totalComments,
        totalLikesReceived,
        uniquePostsCommented,
        activityData,
        mostLikedPosts
      });

      setRecentPosts((userPosts || []).slice(0, 5));
      setRecentComments((userComments || []).slice(0, 10));

    } catch (error) {
      console.error('Error loading social stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (userStatus === 'signing_in' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos contributions sociales...</p>
        </div>
      </div>
    );
  }

  if (userStatus === 'signed_out' || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Veuillez vous connecter pour voir vos contributions sociales.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Vos contributions sociales</h1>
            </div>
            <div className="flex gap-3">
              <Link
                to="/user-dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold"
              >
                Votre tableau de bord
              </Link>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Posts publiés</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalPosts || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Commentaires</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalComments || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Likes reçus</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalLikesReceived || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Posts commentés</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.uniquePostsCommented || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Activité des 6 derniers mois</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.activityData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="posts" fill="#F59E0B" name="Posts" />
              <Bar dataKey="comments" fill="#3B82F6" name="Commentaires" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Posts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Vos posts récents</h2>
            {recentPosts.length > 0 ? (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="border border-gray-200 rounded-md p-4">
                    <Link
                      to={`/posts/${post.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {post.title}
                    </Link>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{post.content}</p>
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                      <span>{new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                      <span>{post.likes || 0} ❤️</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Vous n'avez pas encore publié de post.
                <br />
                <Link to="/social" className="text-orange-600 hover:text-orange-800">
                  Créer votre premier post
                </Link>
              </p>
            )}
          </div>

          {/* Most Liked Posts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Posts les plus appréciés</h2>
            {stats?.mostLikedPosts?.length > 0 ? (
              <div className="space-y-3">
                {stats.mostLikedPosts.map((post, index) => (
                  <div key={post.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <Link
                        to={`/posts/${post.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {post.title}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {new Date(post.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center text-red-600">
                      <span className="mr-1">{post.likes}</span>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Aucun like reçu pour le moment.
              </p>
            )}
          </div>
        </div>

        {/* Recent Comments */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Vos commentaires récents</h2>
          {recentComments.length > 0 ? (
            <div className="space-y-4">
              {recentComments.map((comment) => (
                <div key={comment.id} className="border border-gray-200 rounded-md p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link
                        to={`/posts/${comment.post_id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        Sur: {comment.posts?.title}
                      </Link>
                      <p className="text-sm text-gray-700 mt-2">{comment.content}</p>
                    </div>
                    <span className="text-xs text-gray-500 ml-4">
                      {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Aucun commentaire publié pour le moment.
            </p>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}