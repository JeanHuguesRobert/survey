import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { isDeleted, getMetadata } from '../../lib/metadata';
import { getGroupType, isPrivateGroup, requiresApproval } from '../../lib/socialMetadata';

/**
 * Page détail d'un groupe avec membres et posts
 */
export default function GroupDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (id) {
      loadGroupData();
    }
  }, [id, currentUser]);

  async function loadGroupData() {
    try {
      setLoading(true);
      setError(null);

      // Charger le groupe
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      if (isDeleted(groupData)) {
        throw new Error('Ce groupe a été supprimé');
      }

      setGroup(groupData);

      // Charger les membres
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*, users(id, email, metadata)')
        .eq('group_id', id);

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Vérifier si user actuel est membre/admin
      if (currentUser) {
        const membership = membersData?.find(m => m.user_id === currentUser.id);
        setIsMember(!!membership);
        
        const { data: roleData } = await supabase
          .from('group_roles')
          .select('role')
          .eq('group_id', id)
          .eq('user_id', currentUser.id)
          .single();
        
        setIsAdmin(roleData?.role === 'admin');
      }

      // Charger les posts du groupe
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, users(id, email, metadata)')
        .eq('metadata->>groupId', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (postsError) throw postsError;
      
      const activePosts = (postsData || []).filter(p => !isDeleted(p));
      setPosts(activePosts);

    } catch (err) {
      console.error('Error loading group:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup() {
    if (!currentUser) {
      alert('Vous devez être connecté pour rejoindre un groupe');
      return;
    }

    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: id,
          user_id: currentUser.id,
          metadata: { schemaVersion: 1 }
        });

      if (error) throw error;

      // Si approbation requise
      if (requiresApproval(group)) {
        alert('Demande envoyée ! En attente d\'approbation par les admins.');
      } else {
        alert('Vous avez rejoint le groupe !');
      }

      loadGroupData();
    } catch (err) {
      console.error('Error joining group:', err);
      alert('Erreur lors de l\'adhésion : ' + err.message);
    }
  }

  async function handleLeaveGroup() {
    if (!confirm('Êtes-vous sûr de vouloir quitter ce groupe ?')) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', id)
        .eq('user_id', currentUser.id);

      if (error) throw error;
      
      alert('Vous avez quitté le groupe');
      loadGroupData();
    } catch (err) {
      console.error('Error leaving group:', err);
      alert('Erreur : ' + err.message);
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
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/social')}
          className="mt-4 text-primary-600 hover:underline"
        >
          ← Retour aux groupes
        </button>
      </div>
    );
  }

  if (!group) return null;

  const groupType = getGroupType(group);
  const isPrivate = isPrivateGroup(group);
  const avatarUrl = getMetadata(group, 'avatarUrl');
  const location = getMetadata(group, 'location');
  const tags = getMetadata(group, 'tags', []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={group.name}
              className="w-24 h-24 rounded-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-primary-100 flex items-center justify-center text-4xl">
              {groupType === 'neighborhood' && '🏘️'}
              {groupType === 'association' && '🤝'}
              {groupType === 'community' && '👥'}
              {groupType === 'forum' && '💬'}
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {group.name}
            </h1>
            
            {location && (
              <p className="text-gray-600 mb-2">📍 {location}</p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag, idx) => (
                  <span 
                    key={idx}
                    className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-gray-600 mb-4">{group.description}</p>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {members.length} membre{members.length !== 1 ? 's' : ''}
              </span>
              {isPrivate && (
                <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  🔒 Groupe privé
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {currentUser && !isMember && (
              <button
                onClick={handleJoinGroup}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Rejoindre
              </button>
            )}
            {isMember && !isAdmin && (
              <button
                onClick={handleLeaveGroup}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Quitter
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate(`/groups/${id}/edit`)}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Gérer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Posts / Membres */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Publications</h2>
            
            {isMember && (
              <button
                onClick={() => navigate(`/posts/new?groupId=${id}`)}
                className="w-full mb-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                + Nouvelle publication
              </button>
            )}

            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune publication pour l'instant
              </p>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <div 
                    key={post.id}
                    className="border border-gray-200 rounded p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {getMetadata(post, 'title', 'Sans titre')}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="text-xs text-gray-500">
                      Par {post.users?.email || 'Anonyme'} • {new Date(post.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Membres */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Membres</h2>
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    {member.users?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.users?.email || 'Anonyme'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Depuis {new Date(member.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
