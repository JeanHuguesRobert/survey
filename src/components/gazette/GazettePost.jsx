import React from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function GazettePost({ post, isEditor = false }) {
  const { id, title, content, created_at, users } = post;
  const authorName = users?.display_name || "Anonyme";

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet article de la Gazette ?")) return;

    try {
      const { error } = await supabase
        .from("posts")
        .update({
          metadata: {
            ...post.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: "gazette-editor", // We could track ID if we had currentUser here
          },
        })
        .eq("id", id);

      if (error) throw error;

      // Refresh page to show changes (simple way)
      window.location.reload();
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Erreur : " + err.message);
    }
  }

  const sourceUrl = post.metadata?.sourceUrl;
  const isFacebook = sourceUrl && sourceUrl.includes("facebook.com");

  return (
    <article className="mb-8 break-inside-avoid-column border-b border-[#d4c49c] pb-6 last:border-0">
      <h2 className="font-['Playfair_Display'] font-bold text-2xl mb-2 leading-tight">{title}</h2>

      <div className="font-['EB_Garamond'] text-sm italic mb-4 text-gray-700 flex justify-between items-center">
        <span>Par {authorName}</span>
        {isEditor && (
          <div className="flex gap-2 text-xs font-sans not-italic">
            <Link to={`/posts/${id}/edit`} className="text-blue-800 hover:underline">
              [Modifier]
            </Link>
            <button onClick={handleDelete} className="text-red-800 hover:underline">
              [Supprimer]
            </button>
          </div>
        )}
      </div>

      <div className="font-['EB_Garamond'] text-lg leading-snug text-justify gazette-article-content">
        <style>{`
          .gazette-article-content p {
            margin-bottom: 1em;
            text-indent: 1.5em;
          }
          .gazette-article-content p:first-of-type::first-letter {
            float: left;
            font-family: 'Cinzel', serif;
            font-size: 3.5rem;
            line-height: 0.8;
            padding-right: 0.1em;
            padding-top: 0.1em;
            font-weight: bold;
          }
        `}</style>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>

      {isFacebook && (
        <div className="mt-6 mb-4 flex justify-center">
          <iframe
            src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(sourceUrl)}&width=500&show_text=true&height=500&appId=`}
            width="500"
            height="500"
            style={{ border: "none", overflow: "hidden", maxWidth: "100%" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen={true}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          ></iframe>
        </div>
      )}
    </article>
  );
}
