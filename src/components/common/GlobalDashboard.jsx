import React, { useState, useEffect } from "react";
// import { useSupabase } from '../contexts/SupabaseContext';
import { useCurrentUser } from "../lib/useCurrentUser";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function GlobalDashboard() {
  // const { supabase } = useSupabase();
  const { currentUser } = useCurrentUser();
  const [supabase, setSupabase] = useState(null);
  useEffect(() => {
    import("../lib/supabase").then(({ supabase }) => setSupabase(supabase));
  }, []);
  const [stats, setStats] = useState({
    kudocracy: { propositions: 0, votes: 0, delegations: 0 },
    wiki: { pages: 0, edits: 0 },
    social: { posts: 0, comments: 0 },
    chat: { interactions: 0 },
    profile: { completeness: 0, joinDate: null },
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [contributionData, setContributionData] = useState([]);
  const [activityHeatmap, setActivityHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser?.id) {
      fetchDashboardData();
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = currentUser.id;

      // Fetch all statistics in parallel
      const [
        propositionsRes,
        votesRes,
        delegationsRes,
        wikiPagesRes,
        postsRes,
        commentsRes,
        chatInteractionsRes,
      ] = await Promise.all([
        supabase.from("propositions").select("id", { count: "exact" }).eq("author_id", userId),
        supabase.from("votes").select("id", { count: "exact" }).eq("user_id", userId),
        supabase.from("delegations").select("id", { count: "exact" }).eq("delegator_id", userId),
        supabase.from("wiki_pages").select("id", { count: "exact" }).eq("author_id", userId),
        supabase.from("posts").select("id", { count: "exact" }).eq("user_id", userId),
        supabase.from("comments").select("id", { count: "exact" }).eq("user_id", userId),
        supabase.from("chat_interactions").select("id", { count: "exact" }).eq("user_id", userId),
      ]);

      // Check for errors
      const errors = [
        propositionsRes,
        votesRes,
        delegationsRes,
        wikiPagesRes,
        postsRes,
        commentsRes,
        chatInteractionsRes,
      ].filter((res) => res.error);

      if (errors.length > 0) {
        throw new Error("Failed to fetch some statistics");
      }

      // Calculate profile completeness
      const profileFields = ["display_name", "neighborhood", "interests"];
      const filledFields = profileFields.filter(
        (field) => currentUser[field] && currentUser[field].trim() !== ""
      );
      const completeness = Math.round((filledFields.length / profileFields.length) * 100);

      setStats({
        kudocracy: {
          propositions: propositionsRes.count || 0,
          votes: votesRes.count || 0,
          delegations: delegationsRes.count || 0,
        },
        wiki: {
          pages: wikiPagesRes.count || 0,
          edits: wikiPagesRes.count || 0, // Assuming edits = pages for now
        },
        social: {
          posts: postsRes.count || 0,
          comments: commentsRes.count || 0,
        },
        chat: {
          interactions: chatInteractionsRes.count || 0,
        },
        profile: {
          completeness,
          joinDate: currentUser.created_at,
        },
      });

      // Fetch recent activity
      await fetchRecentActivity(userId);

      // Generate contribution data for charts
      generateContributionData();

      // Generate activity heatmap data
      generateActivityHeatmap();
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async (userId) => {
    try {
      // Fetch recent items from all tables
      const [propositions, wikiPages, posts, comments, chatInteractions] = await Promise.all([
        supabase
          .from("propositions")
          .select("id, title, created_at")
          .eq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("wiki_pages")
          .select("id, title, created_at")
          .eq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("posts")
          .select("id, content, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("comments")
          .select("id, content, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("chat_interactions")
          .select("id, question, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const activities = [];

      // Add propositions
      propositions.data?.forEach((item) => {
        activities.push({
          id: `prop-${item.id}`,
          type: "proposition",
          title: item.title,
          description: "Created a proposition",
          date: item.created_at,
          link: `/kudocracy/proposition/${item.id}`,
        });
      });

      // Add wiki pages
      wikiPages.data?.forEach((item) => {
        activities.push({
          id: `wiki-${item.id}`,
          type: "wiki",
          title: item.title,
          description: "Created/edited wiki page",
          date: item.created_at,
          link: `/wiki/${item.id}`,
        });
      });

      // Add posts
      posts.data?.forEach((item) => {
        activities.push({
          id: `post-${item.id}`,
          type: "post",
          title: item.content.substring(0, 50) + "...",
          description: "Created a post",
          date: item.created_at,
          link: `/social/post/${item.id}`,
        });
      });

      // Add comments
      comments.data?.forEach((item) => {
        activities.push({
          id: `comment-${item.id}`,
          type: "comment",
          title: item.content.substring(0, 50) + "...",
          description: "Commented on a post",
          date: item.created_at,
          link: `/social/post/${item.id}`,
        });
      });

      // Add chat interactions
      chatInteractions.data?.forEach((item) => {
        activities.push({
          id: `chat-${item.id}`,
          type: "chat",
          title: item.question.substring(0, 50) + "...",
          description: "Chat interaction",
          date: item.created_at,
          link: "/chat",
        });
      });

      // Sort by date and take top 10
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentActivity(activities.slice(0, 10));
    } catch (err) {
      console.error("Error fetching recent activity:", err);
    }
  };

  const generateContributionData = () => {
    const data = [
      {
        name: "Kudocracy",
        value: stats.kudocracy.propositions + stats.kudocracy.votes + stats.kudocracy.delegations,
      },
      { name: "Wiki", value: stats.wiki.pages },
      { name: "Social", value: stats.social.posts + stats.social.comments },
      { name: "Chat", value: stats.chat.interactions },
    ];
    setContributionData(data);
  };

  const generateActivityHeatmap = () => {
    // Generate mock heatmap data - in real app, this would be based on actual activity dates
    const data = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split("T")[0],
        activity: Math.floor(Math.random() * 10), // Mock data
      });
    }
    setActivityHeatmap(data.reverse());
  };

  const calculateActivityScore = () => {
    const total =
      stats.kudocracy.propositions +
      stats.kudocracy.votes +
      stats.kudocracy.delegations +
      stats.wiki.pages +
      stats.social.posts +
      stats.social.comments +
      stats.chat.interactions;
    return total;
  };

  const getMostActiveArea = () => {
    const areas = {
      Kudocracy: stats.kudocracy.propositions + stats.kudocracy.votes + stats.kudocracy.delegations,
      Wiki: stats.wiki.pages,
      Social: stats.social.posts + stats.social.comments,
      Chat: stats.chat.interactions,
    };
    return Object.keys(areas).reduce((a, b) => (areas[a] > areas[b] ? a : b));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 text-bauhaus-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-50 mb-2">Global Dashboard</h1>
          <p className="text-gray-300">Overview of your activities across all platform modules</p>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Kudocracy</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Propositions:</span>
                <span className="font-semibold">{stats.kudocracy.propositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Votes:</span>
                <span className="font-semibold">{stats.kudocracy.votes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Delegations:</span>
                <span className="font-semibold">{stats.kudocracy.delegations}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Wiki</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Pages Created:</span>
                <span className="font-semibold">{stats.wiki.pages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Edits:</span>
                <span className="font-semibold">{stats.wiki.edits}</span>
              </div>
            </div>
          </div>

          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Social</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Posts:</span>
                <span className="font-semibold">{stats.social.posts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Comments:</span>
                <span className="font-semibold">{stats.social.comments}</span>
              </div>
            </div>
          </div>

          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Profile</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Completeness:</span>
                <span className="font-semibold">{stats.profile.completeness}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Joined:</span>
                <span className="font-semibold text-sm">
                  {stats.profile.joinDate
                    ? new Date(stats.profile.joinDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contribution Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Contribution Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">Activity Score:</span>
                  <span className="font-semibold text-lg">{calculateActivityScore()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${Math.min((calculateActivityScore() / 50) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Most Active Area:</span>
                <span className="font-semibold">{getMostActiveArea()}</span>
              </div>
            </div>
          </div>

          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Contribution Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "Kudocracy",
                      value:
                        stats.kudocracy.propositions +
                        stats.kudocracy.votes +
                        stats.kudocracy.delegations,
                    },
                    { name: "Wiki", value: stats.wiki.pages },
                    { name: "Social", value: stats.social.posts + stats.social.comments },
                    { name: "Chat", value: stats.chat.interactions },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {[
                    {
                      name: "Kudocracy",
                      value:
                        stats.kudocracy.propositions +
                        stats.kudocracy.votes +
                        stats.kudocracy.delegations,
                    },
                    { name: "Wiki", value: stats.wiki.pages },
                    { name: "Social", value: stats.social.posts + stats.social.comments },
                    { name: "Chat", value: stats.chat.interactions },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className=" rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-50 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg"
                >
                  <div
                    className={`w-3 h-3 rounded-full mt-2 ${
                      activity.type === "proposition"
                        ? "bg-blue-500"
                        : activity.type === "wiki"
                          ? "bg-green-500"
                          : activity.type === "post"
                            ? "bg-purple-500"
                            : activity.type === "comment"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                    }`}
                  ></div>
                  <div className="flex-1">
                    <Link
                      to={activity.link}
                      className="font-medium text-gray-50 hover:text-orange-600"
                    >
                      {activity.title}
                    </Link>
                    <p className="text-sm text-gray-300">{activity.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(activity.date).toLocaleDateString()} at{" "}
                      {new Date(activity.date).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visual Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Activity Timeline</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityHeatmap}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="activity"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className=" rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Activity by Module</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={contributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Access Panel */}
        <div className=" rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-50 mb-4">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/kudocracy"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold text-xl">K</span>
              </div>
              <span className="font-medium text-gray-50">Kudocracy</span>
              <span className="text-sm text-gray-400">Create propositions</span>
            </Link>

            <Link
              to="/wiki"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-green-600 font-bold text-xl">W</span>
              </div>
              <span className="font-medium text-gray-50">Wiki</span>
              <span className="text-sm text-gray-400">Edit pages</span>
            </Link>

            <Link
              to="/social"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-purple-600 font-bold text-xl">S</span>
              </div>
              <span className="font-medium text-gray-50">Social</span>
              <span className="text-sm text-gray-400">Share posts</span>
            </Link>

            <Link
              to="/profile"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-orange-600 font-bold text-xl">P</span>
              </div>
              <span className="font-medium text-gray-50">Profile</span>
              <span className="text-sm text-gray-400">Manage account</span>
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              <Link
                to="/kudocracy/create"
                className="px-4 py-2 bg-blue-600 text-bauhaus-white rounded-md hover:bg-blue-700 transition-colors"
              >
                New Proposition
              </Link>
              <Link
                to="/wiki/create"
                className="px-4 py-2 bg-green-600 text-bauhaus-white rounded-md hover:bg-green-700 transition-colors"
              >
                New Wiki Page
              </Link>
              <Link
                to="/social/create"
                className="px-4 py-2 bg-purple-600 text-bauhaus-white rounded-md hover:bg-purple-700 transition-colors"
              >
                New Post
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
