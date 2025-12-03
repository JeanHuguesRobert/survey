import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import VoteButton from "./VoteButton";
import { canWrite } from "../../lib/permissions";

export default function PropositionCard({ proposition, user }) {
  const [votes, setVotes] = useState({ approve: 0, disapprove: 0, blank: 0 });
  const [userVote, setUserVote] = useState(null);
  const [effectiveVote, setEffectiveVote] = useState(null);
  const [delegatedFrom, setDelegatedFrom] = useState(null);

  useEffect(() => {
    loadVotes();
    if (user) {
      loadUserVote();
      loadEffectiveVote();
    }
  }, [proposition.id, user]);

  const loadVotes = async () => {
    const { data, error } = await supabase
      .from("votes")
      .select("vote_value")
      .eq("proposition_id", proposition.id);

    if (!error && data) {
      const approve = data.filter((v) => v.vote_value === true).length;
      const disapprove = data.filter((v) => v.vote_value === false).length;
      const blank = data.filter((v) => v.vote_value === null).length;
      setVotes({ approve, disapprove, blank });
    }
  };

  const loadUserVote = async () => {
    const { data, error } = await supabase
      .from("votes")
      .select("*")
      .eq("proposition_id", proposition.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error) {
      setUserVote(data);
    }
  };

  const loadEffectiveVote = async () => {
    const propTags = proposition.proposition_tags.map((pt) => pt.tag.id);

    const { data: delegations, error } = await supabase
      .from("delegations")
      .select("*, delegate:users!delegations_delegate_id_fkey(display_name)")
      .eq("delegator_id", user.id)
      .in("tag_id", propTags);

    if (!error && delegations && delegations.length > 0) {
      const delegation = delegations[0];

      const { data: delegateVote } = await supabase
        .from("votes")
        .select("*")
        .eq("proposition_id", proposition.id)
        .eq("user_id", delegation.delegate_id)
        .maybeSingle();

      if (delegateVote) {
        setEffectiveVote(delegateVote);
        setDelegatedFrom(delegation.delegate.display_name);
      }
    }
  };

  const totalVotes = votes.approve + votes.disapprove + votes.blank;
  const approvePercent = totalVotes > 0 ? (votes.approve / totalVotes) * 100 : 0;
  const blankPercent = totalVotes > 0 ? (votes.blank / totalVotes) * 100 : 0;
  const disapprovePercent = totalVotes > 0 ? (votes.disapprove / totalVotes) * 100 : 0;

  return (
    <div className="theme-card p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <Link to={`/propositions/${proposition.id}`} className="group">
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-primary transition-colors font-brand">
              {proposition.title}
            </h3>
          </Link>
          <p className="text-gray-600 mb-4 line-clamp-3">{proposition.description}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {proposition.proposition_tags.map((pt) => (
              <span
                key={pt.tag.id}
                className="filter-chip filter-chip--yellow active cursor-default"
              >
                {pt.tag.name}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-500">
            Par {proposition.author?.display_name || "Anonyme"} •{" "}
            {new Date(proposition.created_at).toLocaleDateString("fr-FR")}
          </p>

          {/* Petition Link */}
          {proposition.metadata?.petition_url && (
            <a
              href={proposition.metadata.petition_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-orange-600 font-semibold hover:text-orange-700 hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
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
              Signer la pétition →
            </a>
          )}

          <Link
            to={`/propositions/${proposition.id}`}
            className="inline-block mt-2 text-sm text-primary font-bold hover:underline  tracking-wide"
          >
            Voir les détails →
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm font-semibold mb-2">
          <span className="text-green-700">
            {votes.approve} Pour ({approvePercent.toFixed(1)}%)
          </span>
          <span className="text-gray-600">
            {votes.blank} Blanc ({blankPercent.toFixed(1)}%)
          </span>
          <span className="text-red-700">
            {votes.disapprove} Contre ({disapprovePercent.toFixed(1)}%)
          </span>
        </div>
        <div className="vote-bar">
          <div
            className="vote-segment vote-segment--approve"
            style={{ width: `${approvePercent}%` }}
            title={`Pour: ${approvePercent.toFixed(1)}%`}
          ></div>
          <div
            className="vote-segment vote-segment--blank"
            style={{ width: `${blankPercent}%` }}
            title={`Blanc: ${blankPercent.toFixed(1)}%`}
          ></div>
          <div
            className="vote-segment vote-segment--disapprove"
            style={{ width: `${disapprovePercent}%` }}
            title={`Contre: ${disapprovePercent.toFixed(1)}%`}
          ></div>
        </div>
      </div>

      {user && canWrite(user) && (
        <div>
          {userVote ? (
            <div className="vote-status">
              <p>
                Vous avez voté :{" "}
                <strong>
                  {userVote.vote_value === true && "Pour"}
                  {userVote.vote_value === false && "Contre"}
                  {userVote.vote_value === null && "Blanc"}
                </strong>
              </p>
            </div>
          ) : effectiveVote && delegatedFrom ? (
            <div className="vote-status vote-status--delegated">
              <p>
                Délégué à {delegatedFrom} qui a voté :{" "}
                <strong>
                  {effectiveVote.vote_value === true && "Pour"}
                  {effectiveVote.vote_value === false && "Contre"}
                  {effectiveVote.vote_value === null && "Blanc"}
                </strong>
              </p>
            </div>
          ) : null}

          <VoteButton
            propositionId={proposition.id}
            userId={user.id}
            currentVote={userVote}
            onVoteChange={() => {
              loadVotes();
              loadUserVote();
            }}
          />
        </div>
      )}

      {(!user || !canWrite(user)) && (
        <div className="vote-status vote-status--info text-center">
          <p>
            {user ? "Les utilisateurs anonymes ne peuvent pas voter" : "Connectez-vous pour voter"}
          </p>
        </div>
      )}
    </div>
  );
}
