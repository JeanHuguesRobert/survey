import { useState } from 'react';

export function ArchiveButton({ pageId, slug }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleArchive = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const body = pageId ? { pageId } : { slug };
      
      console.log('📤 Envoi vers Netlify:', body);
      
      const response = await fetch('/.netlify/functions/sync-wiki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', response.headers);

      const text = await response.text();
      console.log('📥 Response text:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
      }

      if (response.ok) {
        setStatus({
          type: 'success',
          message: data.message === 'Already synced today' 
            ? '✅ Déjà archivé aujourd\'hui'
            : '✅ Page archivée sur GitHub !'
        });
      } else {
        setStatus({
          type: 'error',
          message: `❌ Erreur: ${data.error}`
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleArchive}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Archivage en cours...' : '📦 Archiver sur GitHub'}
      </button>

      {status && (
        <div className={`p-3 rounded ${
          status.type === 'success' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

// Utilisation dans votre page d'édition :
// Avec ID : <ArchiveButton pageId={currentPage.id} />
// Avec slug : <ArchiveButton slug={currentPage.slug} />
// Les deux marchent !