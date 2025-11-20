import { useCurrentUser } from '../lib/useCurrentUser';
import PostView from '../components/social/PostView';

/**
 * Page détail d'un post
 */
export default function PostPage() {
  const { currentUser } = useCurrentUser();

  return <PostView currentUser={currentUser} />;
}
