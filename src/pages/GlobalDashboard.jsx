import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import SiteFooter from '../components/layout/SiteFooter';

const COLORS = ['#0A3F73', '#F54928', '#66BB6A', '#FFA726', '#42A5F5'];

export default function GlobalDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGlobalStats();
  }, []);

  const loadGlobalStats = async () => {
    try {
      setLoading(true);

      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total propositions
      const { count: totalPropositions } = await supabase
        .from('propositions')
        .select('*', { count: 'exact', head: true });

      // Get total votes
      const { count: totalVotes } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true });

      // Get total delegations
      const { count: totalDelegations } = await supabase
        .from('delegations')
        .select('*', { count: 'exact', head: true });

      // Get total wiki pages
      const { count: totalWikiPages } = await supabase
        .from('wiki_pages')
        .select('*', { count: 'exact', head: true });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentPropositions } = await supabase
        .from('propositions')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      const { data: recentVotes } = await supabase
        .from('votes')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: recentWikiEdits } = await supabase
        .from('wiki_revisions')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Calculate activity over time (last 7 days)
      const activityData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayPropositions = recentPropositions?.filter(p =>
          new Date(p.created_at).toDateString() === date.toDateString()
        ).length || 0;

        const dayVotes = recentVotes?.filter(v =>
          new Date(v.created_at).toDateString() === date.toDateString()
        ).length || 0;

        const dayWikiEdits = recentWikiEdits?.filter(w =>
          new Date(w.created_at).toDateString() === date.toDateString()
        ).length || 0;

        activityData.push({
          date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
          propositions: dayPropositions,
          votes: dayVotes,
          wikiEdits: dayWikiEdits
        });
      }

      // Get proposition status distribution
      const { data: propositionStatuses } = await supabase
        .from('propositions')
        .select('status');

      const statusCounts = {};
      propositionStatuses?.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status === 'active' ? 'Actives' :
              status === 'accepted' ? 'Acceptées' :
              status === 'rejected' ? 'Rejetées' :
              status === 'draft' ? 'Brouillons' : status,
        value: count
      }));

      // Get most active users (top 10 by proposition count)
      const { data: userActivity } = await supabase
        .from('propositions')
        .select(`
          author_id,
          profiles!inner(display_name)
        `)
        .then(({ data }) => {
          const userCounts = {};
          data?.forEach(p => {
            const userId = p.author_id;
            const userName = p.profiles?.display_name || 'Anonyme';
            userCounts[userId] = {
              name: userName,
              count: (userCounts[userId]?.count || 0) + 1
            };
          });
          return Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        });

      setStats({
        totalUsers,
        totalPropositions,
        totalVotes,
        totalDelegations,
        totalWikiPages,
        recentActivity: {
          propositions: recentPropositions?.length || 0,
          votes: recentVotes?.length || 0,
          wikiEdits: recentWikiEdits?.length || 0
        },
        activityData,
        statusData,
        topUsers: userActivity || []
      });

    } catch (error) {
      console.error('Error loading global stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord global...</p>
        </div>
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
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Tableau de bord global</h1>
              <p className="text-gray-600">Statistiques générales de la plateforme Kudocracy</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/user-dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold"
              >
                Votre tableau de bord
              </Link>
              <Link
                to="/wiki-dashboard"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold"
              >
                Vos contributions Wiki
              </Link>
              <Link
                to="/social-dashboard"
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 font-semibold"
              >
                Vos contributions sociales
              </Link>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Utilisateurs inscrits</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Propositions</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalPropositions || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Votes exprimés</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalVotes || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pages Wiki</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalWikiPages || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Activité récente (30 jours)</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Nouvelles propositions</span>
                <span className="font-semibold text-green-600">{stats?.recentActivity?.propositions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Votes exprimés</span>
                <span className="font-semibold text-purple-600">{stats?.recentActivity?.votes || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Éditions Wiki</span>
                <span className="font-semibold text-orange-600">{stats?.recentActivity?.wikiEdits || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Statut des propositions</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stats?.statusData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(stats?.statusData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Activité des 7 derniers jours</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.activityData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="propositions" stroke="#0A3F73" strokeWidth={2} name="Propositions" />
              <Line type="monotone" dataKey="votes" stroke="#F54928" strokeWidth={2} name="Votes" />
              <Line type="monotone" dataKey="wikiEdits" stroke="#66BB6A" strokeWidth={2} name="Éditions Wiki" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Contributors */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contributeurs les plus actifs</h2>
          <div className="space-y-3">
            {stats?.topUsers?.map((user, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm mr-3">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
                <span className="text-gray-600">{user.count} proposition{user.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}