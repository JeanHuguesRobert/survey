import { useAuth } from '../lib/supabase';
import GroupForm from '../components/social/GroupForm';

/**
 * Page création de groupe
 */
export default function GroupCreate() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600 mb-4">Vous devez être connecté pour créer un groupe</p>
        <a href="/login" className="text-primary-600 hover:underline">
          Se connecter
        </a>
      </div>
    );
  }

  return <GroupForm currentUser={user} />;
}
