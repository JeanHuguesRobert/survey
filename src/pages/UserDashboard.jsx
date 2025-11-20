import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SiteFooter from '../components/layout/SiteFooter';

const COLORS = ['#0A3F73', '#F54928', '#66BB6A', '#FFA726', '#42A5F5'];

export default function UserDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      loadDashboardData(user);
    } else {
      window.location.href = '/kudocracy';
    }
  };

  const loadDashboardData = async (user) => {
    setLoading(true);

    try {
      // Load personal stats from different areas
      const [
        propositionsRes,
        votesRes,
        delegationsGivenRes,
        postsRes,
        commentsRes,
        wikiEditsRes,
        subscriptionsRes,
        subscribersRes
      ] = await Promise.all([
        supabase.from('propositions').select('id').eq('author_id', user.id),
        supabase.from('votes').select('id, vote_value, created_at').eq('user_id', user.id),
        supabase.from('delegations').select('id').eq('delegator_id', user.id),
        supabase.from('posts').select('id').eq('author_id', user.id),
        supabase.from('comments').select('id').eq('author_id', user.id),
        supabase.from('wiki_revisions').select('id').eq('author_id', user.id),
        supabase.from('content_subscriptions').select('id').eq('user_id', user.id),
        supabase.rpc('count_user_subscribers', { target_user_id: user.id })
      ]);

      const propositionsCreated = propositionsRes.data?.length || 0;
      const votesCast = votesRes.data?.length || 0;
      const delegationsGiven = delegationsGivenRes.data?.length || 0;
      const postsCreated = postsRes.data?.length || 0;
      const commentsMade = commentsRes.data?.length || 0;
      const wikiEdits = wikiEditsRes.data?.length || 0;
      const subscriptionsCount = subscriptionsRes.data?.length || 0;
      const subscribersCount = subscribersRes.data || 0;

      // Activity timeline (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentVotes = votesRes.data?.filter(v => new Date(v.created_at) >= thirtyDaysAgo) || [];
      const activityData = {};
      recentVotes.forEach(vote => {
        const date = new Date(vote.created_at).toISOString().split('T')[0];
        activityData[date] = (activityData[date] || 0) + 1;
      });
      const activityTimeline = Object.entries(activityData)
        .map(([date, count]) => ({ date, votes: count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Vote distribution
      const userVotes = votesRes.data || [];
      const approveVotes = userVotes.filter(v => v.vote_value === true).length;
      const disapproveVotes = userVotes.filter(v => v.vote_value === false).length;
      const blankVotes = userVotes.filter(v => v.vote_value === null).length;

      setStats({
        propositionsCreated,
        votesCast,
        delegationsGiven,
        postsCreated,
        commentsMade,
        wikiEdits,
        subscriptionsCount,
        subscribersCount,
        voteDistribution: [
          { name: 'Pour', value: approveVotes },
          { name: 'Contre', value: disapproveVotes },
          { name: 'Blanc', value: blankVotes }
        ],
        activityTimeline
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="text-gray-600 mt-4">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600">Vous devez être connecté pour accéder à cette page</p>
          <Link to="/kudocracy" className="mt-4 inline-block px-6 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800">
            Aller à Kudocracy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b-4 border-blue-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Votre tableau de bord</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/voting-dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Activité votes
              </Link>
              <Link
                to="/social-dashboard"
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Activité sociale
              </Link>
              <Link
                to="/wiki-dashboard"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Activité Wiki
              </Link>
              <Link
                to="/subscriptions"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                🔔 Abonnements
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">        {/* Personal Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Propositions créées" value={stats.propositionsCreated} color="bg-blue-900" />
          <StatCard title="Votes exprimés" value={stats.votesCast} color="bg-green-600" />
          <StatCard title="Délégations données" value={stats.delegationsGiven} color="bg-yellow-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Posts publiés" value={stats.postsCreated} color="bg-orange-600" />
          <StatCard title="Commentaires" value={stats.commentsMade} color="bg-purple-600" />
          <StatCard title="Éditions Wiki" value={stats.wikiEdits} color="bg-teal-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link to="/subscriptions">
            <StatCard 
              title="Mes abonnements" 
              value={stats.subscriptionsCount} 
              color="bg-indigo-600" 
            />
          </Link>
          <StatCard title="Abonnés à vos contenus" value={stats.subscribersCount} color="bg-pink-600" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Distribution de vos votes</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.voteDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.voteDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Activité récente (30 derniers jours)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="votes" stroke="#0A3F73" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Actions rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              to="/kudocracy?tab=create"
              className="bg-blue-900 text-white p-4 rounded-md hover:bg-blue-800 transition-colors text-center"
            >
              <div className="text-2xl mb-2">💡</div>
              <div className="font-semibold">Créer une proposition</div>
            </Link>
            <Link
              to="/kudocracy?tab=delegations"
              className="bg-green-600 text-white p-4 rounded-md hover:bg-green-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">🤝</div>
              <div className="font-semibold">Gérer les délégations</div>
            </Link>
            <Link
              to="/social"
              className="bg-orange-600 text-white p-4 rounded-md hover:bg-orange-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">💬</div>
              <div className="font-semibold">Publier un post</div>
            </Link>
            <Link
              to="/wiki/new"
              className="bg-teal-600 text-white p-4 rounded-md hover:bg-teal-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-semibold">Créer une page Wiki</div>
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className={`${color} text-white rounded-lg shadow-md p-6`}>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}