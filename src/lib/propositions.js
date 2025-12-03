import { supabase } from "./supabase";

/**
 * Validates a petition URL (optional field)
 * Accepts URLs from known petition platforms or any valid https URL
 * @param {string} url - The URL to validate
 * @returns {{ valid: boolean, warning?: string }} Validation result
 */
export function validatePetitionUrl(url) {
  if (!url || !url.trim()) {
    return { valid: true }; // Empty is valid (optional field)
  }

  const trimmed = url.trim();

  // Basic URL format validation
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "L'URL doit commencer par http:// ou https://" };
    }
  } catch {
    return { valid: false, error: "Format d'URL invalide" };
  }

  // Check for recommended platforms
  const recommendedDomains = [
    "change.org",
    "www.change.org",
    "mesopinions.com",
    "www.mesopinions.com",
  ];

  try {
    const parsed = new URL(trimmed);
    const isRecommended = recommendedDomains.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );

    if (!isRecommended) {
      return {
        valid: true,
        warning: "Conseil : Change.org et MesOpinions.com sont les plateformes recommandées",
      };
    }
  } catch {
    // Already validated above
  }

  return { valid: true };
}

export async function createPropositionWithTags({
  userId,
  title,
  description,
  status = "active",
  selectedTags = [],
  petitionUrl = null,
}) {
  if (!userId) throw new Error("userId is required");
  if (!title?.trim() || !description?.trim()) throw new Error("title and description are required");

  // Validate petition URL if provided
  if (petitionUrl) {
    const validation = validatePetitionUrl(petitionUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Build metadata object
  const metadata = {
    schemaVersion: 1,
  };

  // Add petition_url to metadata if provided
  if (petitionUrl && petitionUrl.trim()) {
    metadata.petition_url = petitionUrl.trim();
  }

  const { data: proposition, error: propError } = await supabase
    .from("propositions")
    .insert({
      title: title.trim(),
      description: description.trim(),
      author_id: userId,
      status,
      metadata,
    })
    .select()
    .single();

  if (propError) throw propError;

  const existingTagIds = selectedTags
    .map((t) => (typeof t === "number" ? t : t?.id))
    .filter((id) => id && !String(id).startsWith("new-"));

  const tagsToCreate = selectedTags
    .filter((t) => typeof t !== "number" && (!t?.id || String(t.id).startsWith("new-")))
    .map((t) => ({ name: (t?.name || "").trim(), description: "" }))
    .filter((tag) => tag.name.length > 0);

  let createdTagIds = [];
  if (tagsToCreate.length > 0) {
    const { data: insertedTags, error: tagsInsertError } = await supabase
      .from("tags")
      .insert(tagsToCreate)
      .select();

    if (tagsInsertError) throw tagsInsertError;
    createdTagIds = insertedTags.map((tag) => tag.id);
  }

  const tagIdsToLink = [...existingTagIds, ...createdTagIds];

  if (tagIdsToLink.length > 0) {
    const linkPayload = tagIdsToLink.map((tagId) => ({
      proposition_id: proposition.id,
      tag_id: tagId,
    }));

    const { error: linkError } = await supabase.from("proposition_tags").insert(linkPayload);

    if (linkError) throw linkError;
  }

  return proposition;
}
