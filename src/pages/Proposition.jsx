import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';
import { linkifyWardWiki } from '../lib/wikiLinks';

export default function Proposition() {
  const { id } = useParams();
  const [proposition, setProposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProposition = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('propositions')
        .select(`
          *,
          author:users!propositions_author_id_fkey(display_name),
          proposition_tags(tag:tags(*))
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        setError('Impossible de charger la proposition');
      } else {
        setProposition(data);
      }
      setLoading(false);
    };

    if (id) loadProposition();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (error || !proposition) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-4">{error || 'Proposition introuvable'}</p>
        <Link to="/kudocracy" className="text-blue-900 hover:underline">Retour aux propositions</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{proposition.title}</h1>
            <p className="text-sm text-gray-500">
              Par {proposition.author?.display_name || 'Anonyme'} • {new Date(proposition.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button
            onClick={() => window.location.href = `/posts/new?linkedType=proposition&linkedId=${proposition.id}`}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            title="Créer une discussion sur cette proposition"
          >
            💬 Discuter
          </button>
        </div>

        <div className="markdown-content">
          {proposition.description && typeof proposition.description === 'string' ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              breaks={true}
          components={{
            a: ({ href = '', children }) => {
              const url = String(href);
              const isExternal = url.startsWith('http') || url.startsWith('//');
              // Supporte [label](wiki/adresse) ou [label](/wiki/adresse) ou [label](wiki:adresse)
              const wikiMatch = url.match(/^\/?wiki(?:\/:|\/)?(.+)$/i);
              if (!isExternal && wikiMatch) {
                const slug = wikiMatch[1].replace(/^\//, '');
                return <Link to={`/wiki/${slug}`} className="text-blue-600 hover:underline">{children}</Link>;
              }
              // Liens internes absolus (ex: /propositions/123) -> Link
              if (!isExternal && url.startsWith('/')) {
                return <Link to={url} className="text-blue-600 hover:underline">{children}</Link>;
              }
              return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>;
            }
          }}
          skipHtml={true}
        >
          {linkifyWardWiki(proposition.description)}
        </ReactMarkdown>
          ) : (
            <p className="text-gray-600">Aucune description fournie.</p>
          )}
        </div>

        {proposition.proposition_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {proposition.proposition_tags.map(pt => (
              <span key={pt.tag.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                {pt.tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link to="/kudocracy" className="text-blue-900 hover:underline">← Retour à la liste</Link>
        </div>
      </div>
    </div>
  );
}