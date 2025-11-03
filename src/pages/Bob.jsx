import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react'

import ChatWindow from '../components/bob/ChatWindow'
// jhr import AdminDashboard from './pages/admin'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Vérifier la session utilisateur
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Écouter les changements d'authentification
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

  return (
    <div className="App">
      {
      // jhr
      false && user?.is_admin ? (
        "Pour l'instant la modération est manuelle, via l'UI de Supabase"
      ) : (
        <ChatWindow user={user} />
      )}
    </div>
  )
  // <AdminDashboard user={user} />
}

export default App
