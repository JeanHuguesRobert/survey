import { useAuth } from '../lib/supabase';
import PostView from '../components/social/PostView';

/**
 * Page détail d'un post
 */
export default function PostPage() {
  const { user } = useAuth();

  return <PostView currentUser={user} />;
}
