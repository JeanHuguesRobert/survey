import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { createPropositionWithTags, validatePetitionUrl } from "../../lib/propositions";

export default function CreateProposition({ user }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Petition URL state
  const [showPetitionField, setShowPetitionField] = useState(false);
  const [petitionUrl, setPetitionUrl] = useState("");
  const [petitionWarning, setPetitionWarning] = useState("");

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    const { data, error } = await supabase.from("tags").select("*").order("name");

    if (!error && data) {
      setTags(data);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const { data, error } = await supabase
      .from("tags")
      .insert({ name: newTagName.toLowerCase().trim() })
      .select()
      .single();

    if (!error && data) {
      setTags([...tags, data]);
      setSelectedTags([...selectedTags, data.id]);
      setNewTagName("");
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    // Validate petition URL if provided
    if (petitionUrl.trim()) {
      const validation = validatePetitionUrl(petitionUrl);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }
    }

    // Les tags sont optionnels: on autorise la création sans tag

    setLoading(true);

    try {
      // DEBUG: Vérifions le user
      console.log("User object:", user);
      console.log("User ID:", user?.id);

      // Vérifions si le user existe dans la table users
      const { data: userExists, error: userCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      console.log("User exists in DB?", userExists);
      console.log("User check error?", userCheckError);

      const proposition = await createPropositionWithTags({
        userId: user.id,
        title: title.trim(),
        description: description.trim(),
        status: "active",
        selectedTags,
        petitionUrl: petitionUrl.trim() || null,
      });

      setSuccess(true);
      setTitle("");
      setDescription("");
      setSelectedTags([]);
      setPetitionUrl("");
      setShowPetitionField(false);
      setPetitionWarning("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erreur lors de la création:", error);
      alert("Erreur lors de la création de la proposition");
    } finally {
      setLoading(false);
    }
  };

  // Handle petition URL change with validation feedback
  const handlePetitionUrlChange = (e) => {
    const url = e.target.value;
    setPetitionUrl(url);

    if (url.trim()) {
      const validation = validatePetitionUrl(url);
      setPetitionWarning(validation.warning || "");
    } else {
      setPetitionWarning("");
    }
  };

  return (
    <div className="   shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-50 mb-6">Créer une nouvelle proposition</h2>

      {success && (
        <div className="bg-green-50 border border-green-200 p-4 mb-6">
          <p className="text-green-800 font-semibold">Proposition créée avec succès !</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-200 font-semibold mb-2">Titre de la proposition</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 "
            placeholder="Ex: Créer un parc public dans le centre-ville"
            required
          />
        </div>

        <div>
          <label className="block text-gray-200 font-semibold mb-2">Description détaillée</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 "
            placeholder="Décrivez votre proposition en détail..."
            required
          />
        </div>

        <div>
          <label className="block text-gray-200 font-semibold mb-2">
            Tags (sélectionnez ou créez)
          </label>

          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                  selectedTags.includes(tag.id)
                    ? "bg-blue-900 text-bauhaus-white"
                    : "bg-gray-800 text-gray-200 hover:bg-gray-500"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 "
              placeholder="Créer un nouveau tag..."
            />
            <button
              type="button"
              onClick={handleCreateTag}
              className="px-4 py-2 bg-gray-600 text-bauhaus-white hover:bg-gray-700"
            >
              Créer
            </button>
          </div>
        </div>

        {/* Petition URL Section */}
        <div className="border-t border-gray-700 pt-4">
          {!showPetitionField ? (
            <button
              type="button"
              onClick={() => setShowPetitionField(true)}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Associer une pétition (Change.org, MesOpinions...)
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-gray-200 font-semibold">
                  Lien vers une pétition
                  <span className="text-gray-400 font-normal text-sm ml-2">(optionnel)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowPetitionField(false);
                    setPetitionUrl("");
                    setPetitionWarning("");
                  }}
                  className="text-gray-400 hover:text-gray-200 text-sm"
                >
                  ✕ Retirer
                </button>
              </div>

              <input
                type="url"
                value={petitionUrl}
                onChange={handlePetitionUrlChange}
                className="w-full px-4 py-2 border border-gray-300"
                placeholder="https://www.change.org/p/ma-petition ou https://www.mesopinions.com/..."
              />

              <p className="text-xs text-gray-400">
                💡 Plateformes recommandées :{" "}
                <a
                  href="https://www.change.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Change.org
                </a>{" "}
                et{" "}
                <a
                  href="https://www.mesopinions.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  MesOpinions.com
                </a>
              </p>

              {petitionWarning && (
                <p className="text-xs text-yellow-400 bg-yellow-900/30 px-3 py-2 rounded">
                  ⚠️ {petitionWarning}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-900 text-bauhaus-white font-bold hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Création en cours..." : "Créer la proposition"}
        </button>
      </form>
    </div>
  );
}
