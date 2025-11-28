import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isDeleted } from "../lib/metadata";
import { useCurrentUser } from "../lib/useCurrentUser";
import GazetteLayout from "../components/gazette/GazetteLayout";
import GazettePost from "../components/gazette/GazettePost";

// Helper to get the Monday of the week for a given date
function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper to format date range
function formatDateRange(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);

  const options = { day: "numeric", month: "long" };
  const startStr = startDate.toLocaleDateString("fr-FR", options);
  const endStr = end.toLocaleDateString("fr-FR", { ...options, year: "numeric" });

  return `Semaine du ${startStr} au ${endStr}`;
}

export default function Gazette() {
  const { name } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const gazetteName = name || "global";
  const { currentUser } = useCurrentUser();
  const [isEditor, setIsEditor] = useState(false);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    loadPosts();
    checkEditorStatus();
  }, [gazetteName, currentUser]);

  async function checkEditorStatus() {
    if (!currentUser) {
      setIsEditor(false);
      return;
    }

    try {
      // Determine target group name
      let targetGroupName = gazetteName;
      if (gazetteName === "global") {
        targetGroupName = import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette";
      }

      // Find group by name (case insensitive matching could be better but let's stick to exact for now as per request)
      const { data: group } = await supabase
        .from("groups")
        .select("id")
        .eq("name", targetGroupName)
        .single();

      if (group) {
        // Check membership
        const { data: member } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", currentUser.id)
          .single();

        if (member) setIsEditor(true);
      }
    } catch (err) {
      console.error("Error checking editor status:", err);
    }
  }

  // Update selected week from URL or default to latest
  useEffect(() => {
    const weekParam = searchParams.get("week");
    if (weekParam && !isNaN(new Date(weekParam).getTime())) {
      setSelectedWeek(new Date(weekParam).getTime());
    } else if (weeks.length > 0 && !selectedWeek) {
      // Default to the most recent week
      setSelectedWeek(weeks[0].timestamp);
    }
  }, [weeks, searchParams]);

  async function loadPosts() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("posts")
        .select("*, users(id, display_name)")
        .eq("metadata->>gazette", gazetteName)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const activePosts = (data || []).filter((p) => !isDeleted(p));

      // Group posts by week
      const postsByWeek = {};
      activePosts.forEach((post) => {
        const date = new Date(post.created_at);
        const monday = getMonday(date);
        const key = monday.getTime();

        if (!postsByWeek[key]) {
          postsByWeek[key] = [];
        }
        postsByWeek[key].push(post);
      });

      // Create weeks array for selector
      const sortedWeeks = Object.keys(postsByWeek)
        .map(Number)
        .sort((a, b) => b - a) // Descending order
        .map((timestamp) => ({
          timestamp,
          label: formatDateRange(new Date(timestamp)),
          posts: postsByWeek[timestamp],
        }));

      setWeeks(sortedWeeks);
      setPosts(activePosts); // Keep all posts in state if needed, but we use weeks mostly
    } catch (err) {
      console.error("Error loading gazette posts:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleWeekChange = (timestamp) => {
    setSelectedWeek(timestamp);
    setSearchParams({ week: new Date(timestamp).toISOString().split("T")[0] });
  };

  if (loading) {
    return (
      <GazetteLayout
        title={gazetteName === "global" ? "LA GAZETTE" : `GAZETTE: ${gazetteName.toUpperCase()}`}
      >
        <div className="text-center italic">Chargement des nouvelles...</div>
      </GazetteLayout>
    );
  }

  const currentWeekPosts = weeks.find((w) => w.timestamp === selectedWeek)?.posts || [];

  return (
    <GazetteLayout
      title={gazetteName === "global" ? "LA GAZETTE" : `GAZETTE: ${gazetteName.toUpperCase()}`}
      weeks={weeks}
      selectedWeek={selectedWeek}
      onWeekChange={handleWeekChange}
    >
      {isEditor && (
        <div className="mb-8 text-center break-inside-avoid-column">
          <Link
            to={`/posts/new?gazette=${gazetteName}`}
            className="inline-block px-6 py-3 bg-[#2c241b] text-[#f4e4bc] font-serif font-bold text-lg border-2 border-[#2c241b] hover:bg-transparent hover:text-[#2c241b] transition-colors"
          >
            ✍️ Rédiger un article
          </Link>
        </div>
      )}

      {weeks.length === 0 ? (
        <div className="text-center italic mt-8">
          <p>Aucune nouvelle à afficher pour le moment.</p>
        </div>
      ) : (
        <>
          {currentWeekPosts.length === 0 ? (
            <div className="text-center italic mt-8">
              <p>Pas de nouvelles pour cette semaine.</p>
            </div>
          ) : (
            currentWeekPosts.map((post) => (
              <GazettePost key={post.id} post={post} isEditor={isEditor} />
            ))
          )}
        </>
      )}
    </GazetteLayout>
  );
}
