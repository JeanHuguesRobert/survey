import { useAuth } from '../lib/supabase';
import GroupDetail from '../components/social/GroupDetail';

/**
 * Page détail d'un groupe
 */
export default function GroupPage() {
  const { user } = useAuth();

  return <GroupDetail currentUser={user} />;
}
