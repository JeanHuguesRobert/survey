import { useState, useEffect } from "react";
import { parseFeed } from "../../lib/FeedAdapter";

export default function CivicPortfolio({ userId, instanceUrl }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        // Fetch the user's activity feed from the instance
        // If instanceUrl is not provided, assume local
        const url = instanceUrl
          ? `${instanceUrl}/api/feed/activity/${userId}`
          : `/api/feed/activity/${userId}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch portfolio");

        const json = await response.json();

        // Extract stats from _stats extension
        if (json._stats) {
          setStats(json._stats);
        }

        // Parse items
        const parsed = parseFeed(json);
        setActivity(parsed.items.slice(0, 5)); // Top 5 recent activities
      } catch (err) {
        console.error("Error loading portfolio:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchPortfolio();
    }
  }, [userId, instanceUrl]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded"></div>;

  return (
    <div className="civic-portfolio bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 font-display text-gray-900 dark:text-white">
        Portefeuille Citoyen
      </h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Contributions" value={stats?.posts || 0} icon="✍️" />
        <StatCard label="Propositions" value={stats?.propositions || 0} icon="💡" />
        <StatCard label="Votes" value={stats?.votes || 0} icon="🗳️" />
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
          Activité Récente
        </h3>
        <div className="space-y-3">
          {activity.map((item) => (
            <div key={item.id} className="text-sm border-l-2 border-blue-500 pl-3 py-1">
              <div className="text-gray-500 text-xs">
                {new Date(item.date_published).toLocaleDateString()}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {item.title}
              </a>
            </div>
          ))}
          {activity.length === 0 && (
            <div className="text-gray-500 italic">Aucune activité récente.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}
