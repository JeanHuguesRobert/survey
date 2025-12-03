import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// import { useSupabase } from '../contexts/SupabaseContext';
import { linkifyWardWiki } from "../lib/wikiLinks";
import CommentSection from "../components/common/CommentSection";
import { useCurrentUser } from "../lib/useCurrentUser";
import VoteButton from "../components/kudocracy/VoteButton";
import SubscribeButton from "../components/common/SubscribeButton";
import FacebookShareButton from "../components/common/FacebookShareButton";
import ShareMenu from "../components/common/ShareMenu";
import { supabase } from "../lib/supabase";

export default function Proposition() {
  // const { supabase } = useSupabase();
  const { id } = useParams();
  const [proposition, setProposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useCurrentUser(); // Hook pour l'utilisateur connecté
  const [votes, setVotes] = useState({ approve: 0, disapprove: 0, blank: 0 });
  const [userVote, setUserVote] = useState(null);

  useEffect(() => {
    if (!supabase || !id) return;
    const loadProposition = async () => {
      console.log("Loading proposition with id:", id);
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("propositions")
          .select(
            `
            *,
            author:users!propositions_author_id_fkey(display_name),
            proposition_tags(tag:tags(*))
          `
          )
          .eq("id", id)
          .maybeSingle();
        console.log("Proposition query result:", { data, error });
        if (error) {
          console.error("Error loading proposition:", error);
          setError("Impossible de charger la proposition: " + error.message);
        } else if (!data) {
          setError("Proposition non trouvée");
        } else {
          setProposition(data);
        }
      } catch (err) {
        console.error("Exception loading proposition:", err);
        setError("Erreur lors du chargement: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProposition();
    loadVotes();
    if (currentUser) {
      loadUserVote();
    }
  }, [id, currentUser]);

  const loadVotes = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("votes")
      .select("vote_value")
      .eq("proposition_id", id);
    if (!error && data) {
      const approve = data.filter((v) => v.vote_value === true).length;
      const disapprove = data.filter((v) => v.vote_value === false).length;
      const blank = data.filter((v) => v.vote_value === null).length;
      setVotes({ approve, disapprove, blank });
    }
  };

  const loadUserVote = async () => {
    if (!currentUser || !supabase) return;
    const { data, error } = await supabase
      .from("votes")
      .select("*")
      .eq("proposition_id", id)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (!error) {
      setUserVote(data);
    }
  };

  const handleVoteChange = () => {
    loadVotes();
    loadUserVote();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-300">Chargement...</p>
      </div>
    );
  }

  if (error || !proposition) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-4">{error || "Proposition introuvable"}</p>
        <Link to="/kudocracy" className="text-blue-900 hover:underline">
          Retour aux propositions
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="   shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-50 mb-2">{proposition.title}</h1>
            <p className="text-sm text-gray-400">
              Par {proposition.author?.display_name || "Anonyme"} •{" "}
              {new Date(proposition.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <ShareMenu
            entityType="proposition"
            entityId={proposition.id}
            title={proposition.title}
            description={proposition.description?.slice(0, 200)}
            currentUserId={currentUser?.id}
          />
        </div>

        <div className="markdown-content mb-6">
          {proposition.description && typeof proposition.description === "string" ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              breaks={true}
              components={{
                a: ({ href = "", children }) => {
                  const url = String(href);
                  const isExternal = url.startsWith("http") || url.startsWith("//");
                  // Supporte [label](wiki/adresse) ou [label](/wiki/adresse) ou [label](wiki:adresse)
                  const wikiMatch = url.match(/^\/?wiki(?:\/:|\/)?(.+)$/i);
                  if (!isExternal && wikiMatch) {
                    const slug = wikiMatch[1].replace(/^\//, "");
                    return (
                      <Link to={`/wiki/${slug}`} className="text-blue-600 hover:underline">
                        {children}
                      </Link>
                    );
                  }
                  // Liens internes absolus (ex: /propositions/123) -> Link
                  if (!isExternal && url.startsWith("/")) {
                    return (
                      <Link to={url} className="text-blue-600 hover:underline">
                        {children}
                      </Link>
                    );
                  }
                  return (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {children}
                    </a>
                  );
                },
              }}
              skipHtml={true}
            >
              {linkifyWardWiki(proposition.description)}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-300">Aucune description fournie.</p>
          )}
        </div>

        {proposition.proposition_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            {proposition.proposition_tags.map((pt) => (
              <span
                key={pt.tag.id}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
              >
                {pt.tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Petition Link */}
        {proposition.metadata?.petition_url && (
          <div className="bg-orange-50 border border-orange-200 p-4 mb-6 rounded-lg">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-orange-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">
                  Une pétition est associée à cette proposition
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Soutenez cette initiative en signant la pétition sur la plateforme externe.
                </p>
              </div>
              <a
                href={proposition.metadata.petition_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700 transition-colors"
              >
                Signer la pétition
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Résultats des votes */}
        <div className="  p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">Résultats des votes</h3>
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-green-700">{votes.approve} Pour</span>
            <span className="text-gray-200">{votes.blank} Blanc</span>
            <span className="text-red-700">{votes.disapprove} Contre</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex mb-4">
            {votes.approve + votes.disapprove + votes.blank > 0 ? (
              <>
                <div
                  className="bg-green-600 h-full transition-all duration-300"
                  style={{
                    width: `${(votes.approve / (votes.approve + votes.disapprove + votes.blank)) * 100}%`,
                  }}
                ></div>
                <div
                  className="bg-gray-400 h-full transition-all duration-300"
                  style={{
                    width: `${(votes.blank / (votes.approve + votes.disapprove + votes.blank)) * 100}%`,
                  }}
                ></div>
                <div
                  className="bg-red-600 h-full transition-all duration-300"
                  style={{
                    width: `${(votes.disapprove / (votes.approve + votes.disapprove + votes.blank)) * 100}%`,
                  }}
                ></div>
              </>
            ) : (
              <div className="w-full text-center text-sm text-gray-400 py-1">Aucun vote</div>
            )}
          </div>

          {/* Afficher le vote de l'utilisateur */}
          {userVote && (
            <div className="bg-blue-50 border border-blue-200 p-3 mb-3">
              <p className="text-sm text-blue-800">
                Vous avez voté :{" "}
                <strong>
                  {userVote.vote_value === true && "Pour"}
                  {userVote.vote_value === false && "Contre"}
                  {userVote.vote_value === null && "Blanc"}
                </strong>
              </p>
            </div>
          )}

          {/* Bouton d'abonnement */}
          <div className="mb-4">
            <SubscribeButton contentType="proposition" contentId={id} currentUser={currentUser} />
          </div>

          {/* Boutons de vote */}
          {currentUser ? (
            <VoteButton
              propositionId={id}
              userId={currentUser.id}
              currentVote={userVote}
              onVoteChange={handleVoteChange}
            />
          ) : (
            <div className=" border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-300">
                <Link to="/kudocracy" className="text-blue-900 hover:underline">
                  Connectez-vous pour voter
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link to="/kudocracy" className="text-blue-900 hover:underline">
            ← Retour à la liste
          </Link>
        </div>
      </div>

      {/* Section de commentaires */}
      <CommentSection
        linkedType="proposition"
        linkedId={proposition.id}
        currentUser={currentUser}
        defaultExpanded={false}
      />
    </div>
  );
}
