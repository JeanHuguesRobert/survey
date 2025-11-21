import { useCurrentUser } from '../lib/useCurrentUser';
import PostView from '../components/social/PostView';

/**
 * Page détail d'un post
 */
export default function PostPage() {
  const { currentUser, userStatus } = useCurrentUser();

  // If you want to add auth-required UI, you can use userStatus here
  return <PostView currentUser={currentUser} />;
}
