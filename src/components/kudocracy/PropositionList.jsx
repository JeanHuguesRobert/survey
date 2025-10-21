import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import PropositionCard from './PropositionCard';

export default function PropositionList({ user }) {
  const [propositions, setPropositions] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
    loadPropositions();

    const subscription = supabase
      .channel('propositions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propositions' }, () => {
        loadPropositions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedTags, searchQuery]);

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    if (!error && data) {
      setTags(data);
    }
  };

  const loadPropositions = async () => {
    setLoading(true);

    let query = supabase
      .from('propositions')
      .select(`
        *,
        author:users!propositions_author_id_fkey(display_name),
        proposition_tags(tag:tags(*))
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      let filtered = data;

      if (selectedTags.length > 0) {
        filtered = filtered.filter(prop =>
          prop.proposition_tags.some(pt => selectedTags.includes(pt.tag.id))
        );
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(prop =>
          prop.title.toLowerCase().includes(query) ||
          prop.description.toLowerCase().includes(query)
        );
      }

      setPropositions(filtered);
    }

    setLoading(false);
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Rechercher et filtrer</h3>

        <input
          type="text"
          placeholder="Rechercher une proposition..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4"
        />

        {tags.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Filtrer par tags :</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="text-gray-600 mt-4">Chargement des propositions...</p>
        </div>
      ) : propositions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600">Aucune proposition trouvée</p>
        </div>
      ) : (
        <div className="space-y-6">
          {propositions.map(proposition => (
            <PropositionCard
              key={proposition.id}
              proposition={proposition}
              user={user}
            />
          ))}
        </div>
      )}
    </div>
  );
}
