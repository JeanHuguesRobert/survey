import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function WikiCreate() {
  const [title, setTitle] = useState('Nouvelle page');
  const [slug, setSlug] = useState('nouvelle-page');
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const handleSave = async () => {
    try {
      const { data: existing, error: slugError } = await supabase
        .from('wiki_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!slugError && existing) {
        alert('Une page avec cette adresse existe déjà. Veuillez en choisir une autre.');
        return;
      }

      const { data, error } = await supabase
        .from('wiki_pages')
        .insert([{ title, content, slug }])
        .select()
        .single();

      if (error) {
        console.error('Erreur création page :', error);
        alert('Une erreur est survenue lors de la création.');
        return;
      }

      navigate(`/wiki/${data.slug}`);
    } catch (err) {
      console.error('Erreur inattendue :', err);
      alert('Une erreur inattendue est survenue.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Créer une nouvelle page</h1>
      <div className="space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="Adresse de la page (ex : page-exemple)"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={20}
          placeholder="Contenu de la page..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Enregistrer
          </button>
          <button
            onClick={() => navigate('/wiki')}
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
