import { useCurrentUser } from '../lib/useCurrentUser';
import ChatWindow from '../components/bob/ChatWindow'

function App() {
  const { currentUser } = useCurrentUser();

  return (
    <div className="App">
      {
      // jhr
      false && currentUser?.is_admin ? (
        "Pour l'instant la modération est manuelle, via l'UI de Supabase"
      ) : (
        <ChatWindow user={currentUser} />
      )}
    </div>
  )
  // <AdminDashboard user={user} />
}

export default App
