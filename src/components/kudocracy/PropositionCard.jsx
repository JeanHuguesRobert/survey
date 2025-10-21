import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import VoteButton from './VoteButton';

export default function PropositionCard({ proposition, user }) {
  const [votes, setVotes] = useState({ approve: 0, disapprove: 0 });
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
      .from('votes')
      .select('vote_value')
      .eq('proposition_id', proposition.id);

    if (!error && data) {
      const approve = data.filter(v => v.vote_value === true).length;
      const disapprove = data.filter(v => v.vote_value === false).length;
      setVotes({ approve, disapprove });
    }
  };

  const loadUserVote = async () => {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('proposition_id', proposition.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error) {
      setUserVote(data);
    }
  };

  const loadEffectiveVote = async () => {
    const propTags = proposition.proposition_tags.map(pt => pt.tag.id);

    const { data: delegations, error } = await supabase
      .from('delegations')
      .select('*, delegate:users!delegations_delegate_id_fkey(display_name)')
      .eq('delegator_id', user.id)
      .in('tag_id', propTags);

    if (!error && delegations && delegations.length > 0) {
      const delegation = delegations[0];

      const { data: delegateVote } = await supabase
        .from('votes')
        .select('*')
        .eq('proposition_id', proposition.id)
        .eq('user_id', delegation.delegate_id)
        .maybeSingle();

      if (delegateVote) {
        setEffectiveVote(delegateVote);
        setDelegatedFrom(delegation.delegate.display_name);
      }
    }
  };

  const totalVotes = votes.approve + votes.disapprove;
  const approvePercent = totalVotes > 0 ? (votes.approve / totalVotes) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{proposition.title}</h3>
            <p className="text-gray-600 mb-4">{proposition.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {proposition.proposition_tags.map(pt => (
                <span
                  key={pt.tag.id}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
                >
                  {pt.tag.name}
                </span>
              ))}
            </div>

            <p className="text-sm text-gray-500">
              Par {proposition.author?.display_name || 'Anonyme'} • {new Date(proposition.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-green-700">{votes.approve} Pour</span>
            <span className="text-red-700">{votes.disapprove} Contre</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-600 h-full transition-all duration-300"
              style={{ width: `${approvePercent}%` }}
            ></div>
          </div>
        </div>

        {user && (
          <div>
            {userVote ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                <p className="text-sm text-blue-800">
                  Vous avez voté : <strong>{userVote.vote_value ? 'Pour' : 'Contre'}</strong>
                </p>
              </div>
            ) : effectiveVote && delegatedFrom ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                <p className="text-sm text-yellow-800">
                  Délégué à {delegatedFrom} qui a voté : <strong>{effectiveVote.vote_value ? 'Pour' : 'Contre'}</strong>
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

        {!user && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
            <p className="text-sm text-gray-600">Connectez-vous pour voter</p>
          </div>
        )}
      </div>
    </div>
  );
}
