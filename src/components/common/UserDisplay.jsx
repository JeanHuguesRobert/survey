import { useUserProfile } from '../../lib/useUserProfile';

/**
 * Affichage compact d'un nom d'utilisateur avec infos optionnelles
 */
export default function UserDisplay({ userId, showNeighborhood = false, className = '' }) {
  const { profile, loading } = useUserProfile(userId);

  if (loading) {
    return <span className={`text-gray-500 ${className}`}>Chargement...</span>;
  }

  if (!profile) {
    return <span className={`text-gray-500 ${className}`}>Utilisateur inconnu</span>;
  }

  return (
    <span className={className}>
      <span className="font-medium">{profile.display_name || profile.email}</span>
      {showNeighborhood && profile.neighborhood && (
        <span className="text-gray-500 text-sm ml-2">
          📍 {profile.neighborhood}
        </span>
      )}
    </span>
  );
}
