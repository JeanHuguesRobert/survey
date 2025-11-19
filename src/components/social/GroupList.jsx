import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isDeleted } from '../../lib/metadata';
import GroupCard from './GroupCard';

/**
 * Liste tous les groupes (forums, quartiers, associations)
 */
export default function GroupList({ filterType = null, currentUserId = null }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGroups();
  }, [filterType]);

  async function loadGroups() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('groups')
        .select('*, group_members(count)');

      // Filtre par type si spécifié
      if (filterType) {
        query = query.eq('metadata->>groupType', filterType);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filtre les groupes supprimés (soft delete)
      const activeGroups = (data || []).filter(g => !isDeleted(g));

      setGroups(activeGroups);
    } catch (err) {
      console.error('Error loading groups:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Erreur lors du chargement des groupes : {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">Aucun groupe pour l'instant</p>
        <p className="text-sm">Créez le premier groupe !</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groups.map(group => (
        <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
