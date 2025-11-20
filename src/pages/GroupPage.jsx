import { useCurrentUser } from '../lib/useCurrentUser';
import GroupDetail from '../components/social/GroupDetail';

/**
 * Page détail d'un groupe
 */
export default function GroupPage() {
  const { currentUser } = useCurrentUser();

  return <GroupDetail currentUser={currentUser} />;
}
