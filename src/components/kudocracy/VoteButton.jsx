import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function VoteButton({ propositionId, userId, currentVote, onVoteChange }) {
  const [loading, setLoading] = useState(false);

  const handleVote = async (voteValue) => {
    setLoading(true);

    try {
      if (currentVote) {
        if (currentVote.vote_value === voteValue) {
          await supabase
            .from('votes')
            .delete()
            .eq('id', currentVote.id);
        } else {
          await supabase
            .from('votes')
            .update({ vote_value: voteValue, updated_at: new Date().toISOString() })
            .eq('id', currentVote.id);
        }
      } else {
        await supabase
          .from('votes')
          .insert({
            user_id: userId,
            proposition_id: propositionId,
            vote_value: voteValue
          });
      }

      onVoteChange();
    } catch (error) {
      console.error('Erreur lors du vote:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleVote(true)}
        disabled={loading}
        className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors disabled:opacity-50 ${
          currentVote?.vote_value === true
            ? 'bg-green-600 text-white'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        Pour
      </button>
      <button
        onClick={() => handleVote(false)}
        disabled={loading}
        className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors disabled:opacity-50 ${
          currentVote?.vote_value === false
            ? 'bg-red-600 text-white'
            : 'bg-red-100 text-red-700 hover:bg-red-200'
        }`}
      >
        Contre
      </button>
    </div>
  );
}
