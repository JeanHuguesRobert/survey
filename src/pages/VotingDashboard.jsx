import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SiteFooter from '../components/layout/SiteFooter';

const COLORS = ['#0A3F73', '#F54928', '#66BB6A', '#FFA726', '#42A5F5'];

export default function VotingDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentPropositions, setRecentPropositions] = useState([]);
  const [recentVotes, setRecentVotes] = useState([]);
  const [activeDelegations, setActiveDelegations] = useState([]);
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
      // Redirect to login if not authenticated
      window.location.href = '/kudocracy';
    }
  };

  const loadDashboardData = async (user) => {
    setLoading(true);

    try {
      // Load personal stats
      const [
        propositionsRes,
        votesRes,
        delegationsGivenRes,
        delegationsReceivedRes
      ] = await Promise.all([
        supabase.from('propositions').select('id').eq('author_id', user.id),
        supabase.from('votes').select('id, vote_value, created_at').eq('user_id', user.id),
        supabase.from('delegations').select('id').eq('delegator_id', user.id),
        supabase.from('delegations').select('id').eq('delegate_id', user.id)
      ]);

      const propositionsCreated = propositionsRes.data?.length || 0;
      const votesCast = votesRes.data?.length || 0;
      const delegationsGivenCount = delegationsGivenRes.data?.length || 0;
      const delegationsReceivedCount = delegationsReceivedRes.data?.length || 0;

      // Vote distribution
      const userVotes = votesRes.data || [];
      const approveVotes = userVotes.filter(v => v.vote_value === true).length;
      const disapproveVotes = userVotes.filter(v => v.vote_value === false).length;
      const blankVotes = userVotes.filter(v => v.vote_value === null).length;

      // Activity timeline (votes per day, last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentVotesData = userVotes.filter(v => new Date(v.created_at) >= thirtyDaysAgo);
      const activityData = {};
      recentVotesData.forEach(vote => {
        const date = new Date(vote.created_at).toISOString().split('T')[0];
        activityData[date] = (activityData[date] || 0) + 1;
      });
      const activityTimeline = Object.entries(activityData)
        .map(([date, count]) => ({ date, votes: count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Recent propositions
      const { data: recentProps } = await supabase
        .from('propositions')
        .select('id, title, description, created_at, status')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Recent votes with proposition details
      const { data: recentVts } = await supabase
        .from('votes')
        .select(`
          id,
          vote_value,
          created_at,
          propositions (
            id,
            title
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Active delegations (given and received)
      const { data: delegationsGivenData } = await supabase
        .from('delegations')
        .select(`
          id,
          created_at,
          tags (name),
          delegate:users!delegations_delegate_id_fkey (display_name)
        `)
        .eq('delegator_id', user.id);

      const { data: delegationsReceivedData } = await supabase
        .from('delegations')
        .select(`
          id,
          created_at,
          tags (name),
          delegator:users!delegations_delegator_id_fkey (display_name)
        `)
        .eq('delegate_id', user.id);

      setStats({
        propositionsCreated,
        votesCast,
        delegationsGiven: delegationsGivenCount,
        delegationsReceived: delegationsReceivedCount,
        voteDistribution: [
          { name: 'Pour', value: approveVotes },
          { name: 'Contre', value: disapproveVotes },
          { name: 'Blanc', value: blankVotes }
        ],
        activityTimeline
      });

      setRecentPropositions(recentProps || []);
      setRecentVotes(recentVts || []);
      setActiveDelegations([
        ...(delegationsGivenData || []).map(d => ({ ...d, type: 'given' })),
        ...(delegationsReceivedData || []).map(d => ({ ...d, type: 'received' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

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
              <h1 className="text-3xl font-bold text-gray-900">Vos votes</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/user-dashboard"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Votre tableau de bord
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Personal Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Propositions créées" value={stats.propositionsCreated} color="bg-blue-900" />
          <StatCard title="Votes exprimés" value={stats.votesCast} color="bg-green-600" />
          <StatCard title="Délégations données" value={stats.delegationsGiven} color="bg-yellow-600" />
          <StatCard title="Délégations reçues" value={stats.delegationsReceived} color="bg-red-600" />
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

        {/* Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Vos propositions récentes</h3>
            {recentPropositions.length > 0 ? (
              <div className="space-y-3">
                {recentPropositions.map(prop => (
                  <div key={prop.id} className="border border-gray-200 rounded-md p-3">
                    <Link to={`/propositions/${prop.id}`} className="text-blue-900 hover:underline font-semibold">
                      {prop.title}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{prop.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(prop.created_at).toLocaleDateString('fr-FR')} • {prop.status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Aucune proposition créée</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Vos votes récents</h3>
            {recentVotes.length > 0 ? (
              <div className="space-y-3">
                {recentVotes.map(vote => (
                  <div key={vote.id} className="border border-gray-200 rounded-md p-3">
                    <Link to={`/propositions/${vote.propositions?.id}`} className="text-blue-900 hover:underline font-semibold">
                      {vote.propositions?.title}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      Vote: <strong>
                        {vote.vote_value === true && 'Pour'}
                        {vote.vote_value === false && 'Contre'}
                        {vote.vote_value === null && 'Blanc'}
                      </strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(vote.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Aucun vote exprimé</p>
            )}
          </div>
        </div>

        {/* Active Delegations */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Délégations actives</h3>
          {activeDelegations.length > 0 ? (
            <div className="space-y-3">
              {activeDelegations.map(delegation => (
                <div key={delegation.id} className="flex justify-between items-center border border-gray-200 rounded-md p-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {delegation.tags?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {delegation.type === 'given'
                        ? `Délégué à ${delegation.delegate?.display_name}`
                        : `Reçu de ${delegation.delegator?.display_name}`
                      }
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    delegation.type === 'given' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {delegation.type === 'given' ? 'Donnée' : 'Reçue'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucune délégation active</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Actions rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              to="/profile"
              className="bg-yellow-600 text-white p-4 rounded-md hover:bg-yellow-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">👤</div>
              <div className="font-semibold">Modifier le profil</div>
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