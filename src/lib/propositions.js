import { supabase } from './supabase';

export async function createPropositionWithTags({ userId, title, description, status = 'active', selectedTags = [] }) {
  if (!userId) throw new Error('userId is required');
  if (!title?.trim() || !description?.trim()) throw new Error('title and description are required');

  const { data: proposition, error: propError } = await supabase
    .from('propositions')
    .insert({
      title: title.trim(),
      description: description.trim(),
      author_id: userId,
      status
    })
    .select()
    .single();

  if (propError) throw propError;

  const existingTagIds = selectedTags
    .map(t => (typeof t === 'number' ? t : t?.id))
    .filter(id => id && !String(id).startsWith('new-'));

  const tagsToCreate = selectedTags
    .filter(t => typeof t !== 'number' && (!t?.id || String(t.id).startsWith('new-')))
    .map(t => ({ name: (t?.name || '').trim(), description: '' }))
    .filter(tag => tag.name.length > 0);

  let createdTagIds = [];
  if (tagsToCreate.length > 0) {
    const { data: insertedTags, error: tagsInsertError } = await supabase
      .from('tags')
      .insert(tagsToCreate)
      .select();

    if (tagsInsertError) throw tagsInsertError;
    createdTagIds = insertedTags.map(tag => tag.id);
  }

  const tagIdsToLink = [...existingTagIds, ...createdTagIds];

  if (tagIdsToLink.length > 0) {
    const linkPayload = tagIdsToLink.map(tagId => ({
      proposition_id: proposition.id,
      tag_id: tagId
    }));

    const { error: linkError } = await supabase
      .from('proposition_tags')
      .insert(linkPayload);

    if (linkError) throw linkError;
  }

  return proposition;
}