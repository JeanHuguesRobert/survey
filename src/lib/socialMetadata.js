/**
 * Helpers spécifiques pour metadata des tables social (groups, posts, comments)
 * Utilise les helpers génériques de metadata.js
 */

import { getMetadata, setMetadata, initMetadata } from "./metadata.js";

// ============ GROUPS ============

/**
 * Types de groupes supportés
 */
export const GROUP_TYPES = {
  NEIGHBORHOOD: "neighborhood", // Quartier
  ASSOCIATION: "association", // Association
  COMMUNITY: "community", // Communauté générale
  FORUM: "forum", // Forum de discussion
  GAZETTE: "gazette", // Gazette (groupe d'éditeurs)
};

/**
 * Crée metadata pour un nouveau groupe
 * @param {string} groupType - Type de groupe (voir GROUP_TYPES)
 * @param {Object} options - Options additionnelles
 * @returns {Object} Metadata initialisé
 */
export function createGroupMetadata(groupType, options = {}) {
  return initMetadata({
    groupType,
    location: options.location || null,
    avatarUrl: options.avatarUrl || null,
    tags: options.tags || [],
  });
}

/**
 * Récupère le type d'un groupe
 */
export function getGroupType(group) {
  return getMetadata(group, "groupType", GROUP_TYPES.COMMUNITY);
}

// ============ POSTS ============

/**
 * Types de posts supportés
 */
export const POST_TYPES = {
  BLOG: "blog", // Article de blog or gazette
  FORUM: "forum", // Thread de forum
  ANNOUNCEMENT: "announcement", // Annonce
  SHARE: "share", // Partage d'un autre contenu
};

/**
 * Types de liens supportés pour posts
 */
export const LINKED_TYPES = {
  WIKI_PAGE: "wiki_page",
  PROPOSITION: "proposition",
  GROUP: "group",
};

/**
 * Crée metadata pour un nouveau post
 * @param {string} postType - Type de post (voir POST_TYPES)
 * @param {string} title - Titre du post
 * @param {Object} options - Options additionnelles
 * @returns {Object} Metadata initialisé
 */
export function createPostMetadata(postType, title, options = {}) {
  const metadata = {
    postType,
    title,
    subtitle: options.subtitle || null,
    subtype: options.subtype || null,
    event: options.event || null,
    incident: options.incident || null,
    groupId: options.groupId || null,
    linkedType: options.linkedType || null,
    linkedId: options.linkedId || null,
    isPinned: options.isPinned || false,
    isLocked: options.isLocked || false,
    tags: options.tags || [],
    gazette: options.gazette || null,
    sourceUrl: options.sourceUrl || null,
    viewCount: 0,
  };

  return initMetadata(metadata);
}

/**
 * Récupère le type d'un article
 */
export function getPostType(post) {
  return getMetadata(post, "postType", POST_TYPES.FORUM);
}

/**
 * Récupère le titre d'un article
 */
export function getPostTitle(post) {
  return getMetadata(post, "title", "");
}

/**
 * Récupère le sous-titre d'un article
 */
export function getPostSubtitle(post) {
  return getMetadata(post, "subtitle", "");
}

/**
 * Récupère le subtype du post (ex: 'event')
 */
export function getPostSubtype(post) {
  return getMetadata(post, "subtype", null);
}

/**
 * Récupère les données d'événement si présentes
 */
export function getPostEvent(post) {
  return getMetadata(post, "event", null);
}

/**
 * Récupère les données d'incident si présentes
 */
export function getPostIncident(post) {
  return getMetadata(post, "incident", null);
}

// ============ LAST MODIFIED BY HISTORY ============

/**
 * Normalise une entrée de modification en objet { id, displayName, timestampISO }
 * @param {Object} entry
 */
export function normalizeModifierEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id || null,
    displayName: entry.displayName || entry.display_name || null,
    timestampISO: entry.timestampISO || entry.timestamp || entry.time || null,
  };
}

/**
 * Retourne la liste `lastModifiedBy` depuis metadata (array, latest first)
 * Toujours retourne un tableau (vide si absent)
 */
export function getLastModifiedByList(metadata) {
  const list = getMetadata({ metadata }, "lastModifiedBy", null);
  if (!list || !Array.isArray(list)) return [];
  // Ensure normalised entries and sort most-recent-first
  const normalised = list
    .map(normalizeModifierEntry)
    .filter(Boolean)
    .sort((a, b) => ((b.timestampISO || "") > (a.timestampISO || "") ? 1 : -1));
  return normalised;
}

/**
 * Retourne l'entrée la plus récente ou null
 */
export function getLatestModifier(metadata, fallback) {
  const list = getLastModifiedByList(metadata);
  if (list.length > 0) return list[0];
  // fallback can be a post object or explicit fallback entry
  if (fallback) {
    if (fallback.author_id) {
      return {
        id: fallback.author_id,
        displayName: fallback.author_display_name || null,
        timestampISO: fallback.created_at || null,
      };
    }
    return normalizeModifierEntry(fallback);
  }
  return null;
}

/**
 * Append or merge a lastModifiedBy entry in metadata
 * - metadata param is the raw metadata object or the parent post
 * - user is { id, displayName }
 * - nowISO is string timestamp (new Date().toISOString())
 * - mergeWindowMs defaults to 1 hour
 * Returns a new metadata object (cloned) with lastModifiedBy updated
 */
export function appendOrMergeLastModifiedBy(
  metadata,
  user,
  nowISO,
  mergeWindowMs = 60 * 60 * 1000
) {
  if (!user || !user.id) return metadata;

  const raw = { ...(metadata || {}) };
  const existing = Array.isArray(raw.lastModifiedBy) ? [...raw.lastModifiedBy] : [];

  const last = existing.length > 0 ? normalizeModifierEntry(existing[0]) : null;
  const userEntry = {
    id: user.id,
    displayName: user.displayName || user.display_name || null,
    timestampISO: nowISO || new Date().toISOString(),
  };

  if (last && last.id === userEntry.id && last.timestampISO) {
    const lastTime = new Date(last.timestampISO).getTime();
    const nowTime = new Date(userEntry.timestampISO).getTime();
    if (!Number.isNaN(lastTime) && nowTime - lastTime <= mergeWindowMs) {
      // merge: update timestamp of the latest entry
      existing[0] = { ...existing[0], timestampISO: userEntry.timestampISO };
      raw.lastModifiedBy = existing;
      return raw;
    }
  }

  // prepend (most-recent-first)
  raw.lastModifiedBy = [userEntry, ...existing];
  return raw;
}

/**
 * Récupère le groupId d'un article (null si pas dans un groupe)
 */
export function getPostGroupId(post) {
  return getMetadata(post, "groupId", null);
}

/**
 * Vérifie si un article est lié à une autre entité (wiki, proposition)
 */
export function hasLinkedEntity(post) {
  const linkedType = getMetadata(post, "linkedType", null);
  const linkedId = getMetadata(post, "linkedId", null);
  return linkedType && linkedId;
}

/**
 * Récupère l'entité liée d'un article
 */
export function getLinkedEntity(post) {
  return {
    type: getMetadata(post, "linkedType", null),
    id: getMetadata(post, "linkedId", null),
  };
}

/**
 * Vérifie si un article est épinglé
 */
export function isPinned(post) {
  return getMetadata(post, "isPinned", false) === true;
}

/**
 * Vérifie si un article est verrouillé (pas de nouveaux comments)
 */
export function isLocked(post) {
  return getMetadata(post, "isLocked", false) === true;
}

/**
 * Incrémente le compteur de vues d'un article
 */
export function incrementViewCount(post) {
  const currentCount = getMetadata(post, "viewCount", 0);
  return setMetadata(post, { viewCount: currentCount + 1 });
}

// ============ HIERARCHICAL POSTS (FORUM THREADS) ============

/**
 * Get parent ID from metadata (reusable for any entity type)
 * @param {Object} entity - Post, comment, or any entity with metadata
 * @returns {string|null} Parent entity ID
 */
export function getParentId(entity) {
  return getMetadata(entity, "parent_id", null);
}

/**
 * Set parent ID in metadata
 * @param {Object} entity - Entity to update
 * @param {string|null} parentId - Parent entity ID
 * @returns {Object} Updated entity with metadata
 */
export function setParentId(entity, parentId) {
  return setMetadata(entity, { parent_id: parentId });
}

/**
 * Check if entity is a root (has no parent)
 * @param {Object} entity
 * @returns {boolean}
 */
export function isRootEntity(entity) {
  return !getParentId(entity);
}

/**
 * Check if post is a root thread (no parent, marked as root)
 * @param {Object} post
 * @returns {boolean}
 */
export function isRootThread(post) {
  return getMetadata(post, "isRootThread", false) || isRootEntity(post);
}

/**
 * Check if post is a sub-post (has parent)
 * @param {Object} post
 * @returns {boolean}
 */
export function isSubPost(post) {
  return !!getParentId(post);
}

/**
 * Get thread depth (how many levels deep in the hierarchy)
 * @param {Object} post
 * @returns {number}
 */
export function getThreadDepth(post) {
  return getMetadata(post, "threadDepth", 0);
}

/**
 * Get root post ID of a thread
 * @param {Object} post
 * @returns {string} Root post ID (or own ID if is root)
 */
export function getRootThreadId(post) {
  return getMetadata(post, "rootPostId") || post.id;
}

/**
 * Get thread statistics
 * @param {Object} post
 * @returns {Object} Thread stats
 */
export function getThreadStats(post) {
  return getMetadata(post, "threadStats", {
    directReplies: 0,
    totalReplies: 0,
    totalComments: 0,
    maxDepth: 0,
    lastActivityAt: null,
  });
}

/**
 * Create metadata for a sub-post (reply to another post)
 * @param {string} postType - Type of post
 * @param {string} title - Post title
 * @param {string} parentPostId - ID of parent post
 * @param {Object} parentPost - Full parent post object (to extract context)
 * @param {Object} options - Additional options
 * @returns {Object} Metadata object
 */
export function createSubPostMetadata(postType, title, parentPostId, parentPost, options = {}) {
  const parentDepth = getThreadDepth(parentPost);
  const rootId = getRootThreadId(parentPost);

  return createPostMetadata(postType, title, {
    ...options,
    parent_id: parentPostId,
    threadDepth: parentDepth + 1,
    rootPostId: rootId,
    isRootThread: false,
    replyToAuthor: parentPost.author_id
      ? {
          id: parentPost.author_id,
          displayName: parentPost.users?.display_name || null,
        }
      : null,
  });
}

/**
 * Update thread statistics (call after adding/removing posts/comments)
 * @param {Object} rootPost - Root post to update
 * @param {Array} allThreadPosts - All posts in the thread
 * @param {Object} commentCounts - Map of postId -> comment count
 * @returns {Object} Updated metadata object
 */
export function updateThreadStats(rootPost, allThreadPosts, commentCounts = {}) {
  const directReplies = allThreadPosts.filter((p) => getParentId(p) === rootPost.id).length;
  const totalReplies = allThreadPosts.length - 1; // Exclude root
  const totalComments = Object.values(commentCounts).reduce((sum, count) => sum + count, 0);
  const maxDepth = Math.max(...allThreadPosts.map((p) => getThreadDepth(p)), 0);
  const lastActivity = allThreadPosts.reduce((latest, p) => {
    const updated = new Date(p.updated_at || p.created_at);
    return updated > latest ? updated : latest;
  }, new Date(rootPost.created_at));

  const threadStats = {
    directReplies,
    totalReplies,
    totalComments,
    maxDepth,
    lastActivityAt: lastActivity.toISOString(),
  };

  return setMetadata(rootPost, { threadStats });
}

// ============ SHARES ============

/**
 * Crée metadata pour un post de type share
 * @param {string} entityType - Type d'entité partagée ("post", future: "wiki_page", etc.)
 * @param {string} entityId - UUID de l'entité partagée
 * @param {Object} options - Options additionnelles
 * @returns {Object} Metadata initialisé
 */
export function createSharePostMetadata(entityType, entityId, options = {}) {
  return initMetadata({
    postType: POST_TYPES.SHARE,
    share: {
      entityType,
      entityId,
      sharedBy: options.userId,
      sharedAt: new Date().toISOString(),
      sharedToGazette: options.gazette || null,
      sharedToGroup: options.groupId || null,
    },
    title: options.title || "Partage",
  });
}

/**
 * Récupère les informations de partage d'un post
 * @param {Object} post
 * @returns {Object|null} Info du partage ou null
 */
export function getShareInfo(post) {
  return getMetadata(post, "share", null);
}

/**
 * Récupère la liste des partages d'un post original
 * @param {Object} post
 * @returns {Array} Liste des partages
 */
export function getShares(post) {
  return getMetadata(post, "shares", []);
}

/**
 * Récupère le nombre de partages actifs d'un post
 * @param {Object} post
 * @returns {number} Nombre de partages
 */
export function getShareCount(post) {
  const shares = getShares(post);
  return shares.filter((s) => !s.isDeleted).length;
}

// ============ COMMENTS ============

/**
 * Crée metadata pour un nouveau commentaire
 * @param {Object} options - Options
 * @returns {Object} Metadata initialisé
 */
export function createCommentMetadata(options = {}) {
  return initMetadata({
    parentCommentId: options.parentCommentId || null,
    isEdited: false,
    editedAt: null,
  });
}

/**
 * Récupère l'ID du commentaire parent (null si commentaire de premier niveau)
 */
export function getParentCommentId(comment) {
  return getMetadata(comment, "parentCommentId", null);
}

/**
 * Vérifie si un commentaire est une réponse à un autre commentaire
 */
export function isReply(comment) {
  return getParentCommentId(comment) !== null;
}

/**
 * Vérifie si un commentaire a été édité
 */
export function isEdited(comment) {
  return getMetadata(comment, "isEdited", false) === true;
}

/**
 * Marque un commentaire comme édité
 */
export function markAsEdited(comment) {
  return setMetadata(comment, {
    isEdited: true,
    editedAt: new Date().toISOString(),
  });
}

// ============ REACTIONS ============

/**
 * Emojis de réaction supportés
 */
export const REACTION_EMOJIS = {
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
  HEART: "❤️",
  LAUGH: "😂",
  THINKING: "🤔",
  CELEBRATE: "🎉",
  EYES: "👀",
};

/**
 * Crée metadata pour une réaction
 * @param {Object} options - Options
 * @returns {Object} Metadata initialisé
 */
export function createReactionMetadata(options = {}) {
  return initMetadata({
    note: options.note || null, // Note optionnelle pour contexte
  });
}

// ============ ACTIVITY LOG ============

/**
 * Types d'actions pour l'activity log
 */
export const ACTIVITY_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  PIN: "pin",
  UNPIN: "unpin",
  LOCK: "lock",
  UNLOCK: "unlock",
  JOIN: "join",
  LEAVE: "leave",
  PROMOTE: "promote",
  DEMOTE: "demote",
};

/**
 * Types de ressources pour l'activity log
 */
export const RESOURCE_TYPES = {
  GROUP: "group",
  POST: "post",
  COMMENT: "comment",
  REACTION: "reaction",
  GROUP_MEMBER: "group_member",
};

/**
 * Crée metadata pour une entrée d'activity log
 * @param {Object} details - Détails de l'action
 * @returns {Object} Metadata initialisé
 */
export function createActivityMetadata(details = {}) {
  return initMetadata(details);
}
