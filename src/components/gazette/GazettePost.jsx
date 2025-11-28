import React from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function GazettePost({ post, isEditor = false }) {
  const { id, title, content, created_at, users } = post;
  const authorName = users?.display_name || "Anonyme";
  const sourceUrl = post.metadata?.sourceUrl;
  const isFacebook = sourceUrl && sourceUrl.includes("facebook.com");
  // normalize problematic non-breaking spaces Supabase AI may insert
  const sanitizedContent = content ? content.replace(/\u202F|\u00A0/g, " ") : content;

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
            deletedBy: "gazette-editor", // could be current user id
          },
        })
        .eq("id", id);
      if (error) throw error;
      // simple refresh
      window.location.reload();
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Erreur : " + err.message);
    }
  }

  return (
    <article className="mb-8 border-b border-[#d4c49c] pb-6 last:border-0">
      <h2
        style={{ color: "#2c241b" }}
        className="font-['Playfair_Display'] font-bold text-2xl mb-2 leading-tight text-[#2c241b]"
      >
        {title}
      </h2>
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
          .gazette-article-content,
          .gazette-article-content h1,
          .gazette-article-content h2,
          .gazette-article-content h3,
          .gazette-article-content h4,
          .gazette-article-content h5,
          .gazette-article-content h6,
          .gazette-article-content p,
          .gazette-article-content strong,
          .gazette-article-content em,
          .gazette-article-content a {
            color: #2c241b !important;
          }
          /* keep headings readable: don't apply newspaper justification/indent */
          .gazette-article-content h1,
          .gazette-article-content h2,
          .gazette-article-content h3,
          .gazette-article-content h4,
          .gazette-article-content h5,
          .gazette-article-content h6 {
            text-align: left !important;
            text-indent: 0 !important;
            margin-top: 0.6em !important;
            margin-bottom: 0.4em !important;
            padding: 0 !important;
            display: block !important;
          }
          /* ensure inline semantics for emphasis/strong tags (prevent large gaps) */
          .gazette-article-content strong,
          .gazette-article-content em {
            display: inline !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: normal !important;
          }
          .gazette-article-content a {
            color: #1e40af !important;
            text-decoration: underline;
          }
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
        <ReactMarkdown>{sanitizedContent}</ReactMarkdown>
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
          />
        </div>
      )}
    </article>
  );
}
