import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function CreateProposition({ user }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    if (!error && data) {
      setTags(data);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.toLowerCase().trim() })
      .select()
      .single();

    if (!error && data) {
      setTags([...tags, data]);
      setSelectedTags([...selectedTags, data.id]);
      setNewTagName('');
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (selectedTags.length === 0) {
      alert('Veuillez sélectionner au moins un tag');
      return;
    }

    setLoading(true);

    try {
      // DEBUG: Vérifions le user
      console.log('User object:', user);
      console.log('User ID:', user?.id);
      
      // Vérifions si le user existe dans la table users
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();
      
      console.log('User exists in DB?', userExists);
      console.log('User check error?', userCheckError);

      const { data: proposition, error: propError } = await supabase
        .from('propositions')
        .insert({
          title: title.trim(),
          description: description.trim(),
          author_id: user.id,
          status: 'active'
        })
        .select()
        .single();

      if (propError) throw propError;

      const tagInserts = selectedTags.map(tagId => ({
        proposition_id: proposition.id,
        tag_id: tagId
      }));

      const { error: tagError } = await supabase
        .from('proposition_tags')
        .insert(tagInserts);

      if (tagError) throw tagError;

      setSuccess(true);
      setTitle('');
      setDescription('');
      setSelectedTags([]);

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création de la proposition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer une nouvelle proposition</h2>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <p className="text-green-800 font-semibold">Proposition créée avec succès !</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Titre de la proposition
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
            placeholder="Ex: Créer un parc public dans le centre-ville"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Description détaillée
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
            placeholder="Décrivez votre proposition en détail..."
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Tags (sélectionnez ou créez)
          </label>

          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
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

          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Créer un nouveau tag..."
            />
            <button
              type="button"
              onClick={handleCreateTag}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Créer
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-900 text-white font-bold rounded-md hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Création en cours...' : 'Créer la proposition'}
        </button>
      </form>
    </div>
  );
}
