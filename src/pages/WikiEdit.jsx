import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function WikiEdit() {
  const { slug: initialSlug } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState(initialSlug);
  const [content, setContent] = useState('');
  const [pageId, setPageId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      const { data, error } = await supabase
        .from('wiki_pages')
        .select('*')
        .eq('slug', initialSlug)
        .single();

      if (error || !data) {
        alert('Page introuvable.');
        navigate('/wiki');
        return;
      }

      setPageId(data.id);
      setTitle(data.title || '');
      setSlug(data.slug || '');
      setContent(data.content || '');
      setLoading(false);
    };

    loadPage();
  }, [initialSlug, navigate]);

  const handleSave = async () => {
    try {
      const { data: slugPage, error: slugError } = await supabase
        .from('wiki_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (slugError && slugError.code !== 'PGRST116') {
        console.error('Erreur vérification slug :', slugError);
        alert('Une erreur est survenue lors de la vérification de l’adresse.');
        return;
      }

      if (slugPage && slugPage.id !== pageId) {
        alert('Une autre page utilise déjà cette adresse.');
        return;
      }

      const { error } = await supabase
        .from('wiki_pages')
        .update({ title, content, slug, updated_at: new Date() })
        .eq('id', pageId);

      if (error) {
        console.error('Erreur mise à jour :', error);
        alert('Une erreur est survenue lors de la mise à jour.');
        return;
      }

      navigate(`/wiki/${slug}`);
    } catch (err) {
      console.error('Erreur inattendue :', err);
      alert('Une erreur inattendue est survenue.');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Modifier la page</h1>
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
            onClick={() => navigate(`/wiki/${initialSlug}`)}
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
