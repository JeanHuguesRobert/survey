import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../lib/useCurrentUser";

export default function FilSubmissionForm() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "fil_link", // fil_link, fil_doc, fil_alert, fil_event, fil_testimony
    source_type: "external",
    external_url: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return alert("Connectez-vous pour soumettre");

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No access token found");

      const response = await fetch("/api/fil/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          source_type: formData.source_type,
          external_url: formData.external_url || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Submission failed");
      }

      navigate("/fil");
    } catch (err) {
      console.error("Submission error:", err);
      alert("Erreur lors de la soumission: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-6 font-bauhaus text-bauhaus-black">Soumettre au Fil</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Titre de l'information
          </label>
          <input
            type="text"
            required
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Fermeture du pont du Fango..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="fil_link">Lien / Article</option>
              <option value="fil_doc">Document Officiel</option>
              <option value="fil_alert">Alerte / Urgence</option>
              <option value="fil_event">Événement</option>
              <option value="fil_testimony">Témoignage</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Source</label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              value={formData.source_type}
              onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
            >
              <option value="external">Externe (URL)</option>
              <option value="internal">Interne (Texte seul)</option>
            </select>
          </div>
        </div>

        {formData.source_type === "external" && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">URL de la source</label>
            <input
              type="url"
              required
              className="w-full p-2 border border-gray-300 rounded"
              value={formData.external_url}
              onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Description / Contenu
          </label>
          <textarea
            className="w-full p-2 border border-gray-300 rounded h-32"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Détails supplémentaires..."
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bauhaus-black text-white font-bold py-3 rounded hover:bg-gray-800 transition-colors"
          >
            {loading ? "Envoi..." : "Publier sur Le Fil"}
          </button>
        </div>
      </form>
    </div>
  );
}
