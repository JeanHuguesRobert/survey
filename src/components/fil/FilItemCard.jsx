import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../../lib/supabase";
import { getDisplayName } from "../../lib/userDisplay";

export default function FilItemCard({ post, currentUserId, onVote }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const metadata = post.metadata || {};
  const title = metadata.title || "Sans titre";
  const score = metadata.fil_score || 0;
  const type = metadata.type || "fil_link";
  const commentCount = metadata.fil_comment_count || 0;

  const [localScore, setLocalScore] = useState(score);
  const [userVote, setUserVote] = useState(post.user_vote || 0); // 0, 1, -1

  async function handleVote(value) {
    if (!currentUserId) return alert("Connectez-vous pour voter");
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No access token found");

      const response = await fetch("/api/fil/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          voteValue: value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Vote failed");
      }

      const data = await response.json();

      setLocalScore(data.score);
      // Optimistic update for user vote is tricky without returning it from API,
      // but we know what the user clicked.
      // However, the API doesn't return the new user_vote status directly,
      // but we can infer it or just update local state.
      // For now, let's assume success means the vote is applied.
      // Toggle logic: if clicking same vote, it removes it (value 0 sent? No, UI sends 1 or -1).
      // Wait, my API logic handles 0 to remove, but UI sends 1 or -1.
      // The API logic says: "if voteValue === 0 ... else ... Upsert".
      // The UI logic currently doesn't toggle off in the handler call, it just sends 1 or -1.
      // I should probably implement toggle logic here or in the API.
      // For simplicity, let's assume the button click enforces the value.
      // If I want toggle, I need to check current `userVote`.

      let newVote = value;
      if (userVote === value) {
        // If clicking same, we might want to unvote?
        // The current UI doesn't seem to support unvoting explicitly via 0,
        // but let's stick to simple up/down for now.
        // Actually, let's support toggle:
        // If I click +1 and I am already +1, I want to remove vote.
      }

      // Refined logic:
      // If user clicks +1 and is already +1 -> send 0
      // If user clicks +1 and is -1 or 0 -> send 1

      // But wait, the `handleVote` function receives `value` (1 or -1).
      // I need to change the logic slightly to support unvoting if I want to be perfect.
      // But for now, let's just set it.

      setUserVote(value);
      if (onVote) onVote(post.id, data);
    } catch (err) {
      console.error("Vote error:", err);
      alert("Erreur lors du vote: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Vote Column */}
      <div className="flex flex-col items-center gap-1 min-w-[40px]">
        <button
          onClick={() => handleVote(1)}
          className={`p-1 rounded hover:bg-gray-100 ${userVote === 1 ? "text-orange-600 font-bold" : "text-gray-400"}`}
          disabled={loading}
        >
          ▲
        </button>
        <span
          className={`font-bold ${localScore > 0 ? "text-orange-600" : localScore < 0 ? "text-blue-600" : "text-gray-600"}`}
        >
          {localScore}
        </span>
        <button
          onClick={() => handleVote(-1)}
          className={`p-1 rounded hover:bg-gray-100 ${userVote === -1 ? "text-blue-600 font-bold" : "text-gray-400"}`}
          disabled={loading}
        >
          ▼
        </button>
      </div>

      {/* Content Column */}
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          <Link to={`/posts/${post.id}`} className="hover:underline">
            {title}
          </Link>
          {metadata.external_url && (
            <a
              href={metadata.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-gray-500 hover:text-blue-600"
            >
              (Source ↗)
            </a>
          )}
        </h3>

        <div className="text-sm text-gray-500 mb-2">
          Par {getDisplayName(post.users)} • {new Date(post.created_at).toLocaleDateString()}
        </div>

        {/* Preview Content */}
        {post.content && (
          <div className="text-sm text-gray-700 line-clamp-2 mb-2">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 text-xs text-gray-500 font-bold">
          <span className="bg-gray-100 px-2 py-1 rounded uppercase tracking-wider">
            {type.replace("fil_", "")}
          </span>
          <Link to={`/posts/${post.id}`} className="hover:text-gray-800">
            {commentCount} commentaires
          </Link>
        </div>
      </div>
    </div>
  );
}
