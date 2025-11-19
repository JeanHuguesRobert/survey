import { Link } from 'react-router-dom';
import { getMetadata } from '../../lib/metadata';
import { getGroupType, isPrivateGroup } from '../../lib/socialMetadata';

/**
 * Carte d'affichage d'un groupe
 */
export default function GroupCard({ group, currentUserId }) {
  const groupType = getGroupType(group);
  const isPrivate = isPrivateGroup(group);
  const avatarUrl = getMetadata(group, 'avatarUrl');
  const location = getMetadata(group, 'location');
  const tags = getMetadata(group, 'tags', []);
  const memberCount = group.group_members?.[0]?.count || 0;

  // Icônes par type
  const typeIcons = {
    neighborhood: '🏘️',
    association: '🤝',
    community: '👥',
    forum: '💬'
  };

  // Labels par type
  const typeLabels = {
    neighborhood: 'Quartier',
    association: 'Association',
    community: 'Communauté',
    forum: 'Forum'
  };

  return (
    <Link 
      to={`/groups/${group.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
    >
      {/* Header avec avatar */}
      <div className="flex items-start gap-4 mb-4">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={group.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-primary-100 flex items-center justify-center text-3xl">
            {typeIcons[groupType] || '👥'}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {group.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="bg-gray-100 px-2 py-0.5 rounded">
              {typeLabels[groupType] || 'Groupe'}
            </span>
            {isPrivate && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded flex items-center gap-1">
                🔒 Privé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {group.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {group.description}
        </p>
      )}

      {/* Location si présente */}
      {location && (
        <div className="text-sm text-gray-500 mb-3 flex items-center gap-1">
          📍 {location}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 3).map((tag, idx) => (
            <span 
              key={idx}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-gray-500">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer avec stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t">
        <span>{memberCount} membre{memberCount !== 1 ? 's' : ''}</span>
        <span className="text-xs">
          {new Date(group.created_at).toLocaleDateString('fr-FR')}
        </span>
      </div>
    </Link>
  );
}
