/**
 * Helpers spécifiques pour metadata des tables social (groups, posts, comments)
 * Utilise les helpers génériques de metadata.js
 */

import { getMetadata, setMetadata, initMetadata } from './metadata.js';

// ============ GROUPS ============

/**
 * Types de groupes supportés
 */
export const GROUP_TYPES = {
  NEIGHBORHOOD: 'neighborhood',     // Quartier
  ASSOCIATION: 'association',       // Association
  COMMUNITY: 'community',           // Communauté générale
  FORUM: 'forum'                   // Forum de discussion
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
    isPrivate: options.isPrivate || false,
    requireApproval: options.requireApproval || false
  });
}

/**
 * Récupère le type d'un groupe
 */
export function getGroupType(group) {
  return getMetadata(group, 'groupType', GROUP_TYPES.COMMUNITY);
}

/**
 * Vérifie si un groupe est privé
 */
export function isPrivateGroup(group) {
  return getMetadata(group, 'isPrivate', false) === true;
}

/**
 * Vérifie si un groupe nécessite approbation pour rejoindre
 */
export function requiresApproval(group) {
  return getMetadata(group, 'requireApproval', false) === true;
}

// ============ POSTS ============

/**
 * Types de posts supportés
 */
export const POST_TYPES = {
  BLOG: 'blog',               // Article de blog
  FORUM: 'forum',             // Thread de forum
  ANNOUNCEMENT: 'announcement' // Annonce
};

/**
 * Types de liens supportés pour posts
 */
export const LINKED_TYPES = {
  WIKI_PAGE: 'wiki_page',
  PROPOSITION: 'proposition',
  GROUP: 'group'
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
    groupId: options.groupId || null,
    linkedType: options.linkedType || null,
    linkedId: options.linkedId || null,
    isPinned: options.isPinned || false,
    isLocked: options.isLocked || false,
    tags: options.tags || [],
    viewCount: 0
  };
  
  return initMetadata(metadata);
}

/**
 * Récupère le type d'un post
 */
export function getPostType(post) {
  return getMetadata(post, 'postType', POST_TYPES.FORUM);
}

/**
 * Récupère le titre d'un post
 */
export function getPostTitle(post) {
  return getMetadata(post, 'title', '');
}

/**
 * Récupère le groupId d'un post (null si pas dans un groupe)
 */
export function getPostGroupId(post) {
  return getMetadata(post, 'groupId', null);
}

/**
 * Vérifie si un post est lié à une autre entité (wiki, proposition)
 */
export function hasLinkedEntity(post) {
  const linkedType = getMetadata(post, 'linkedType', null);
  const linkedId = getMetadata(post, 'linkedId', null);
  return linkedType && linkedId;
}

/**
 * Récupère l'entité liée d'un post
 */
export function getLinkedEntity(post) {
  return {
    type: getMetadata(post, 'linkedType', null),
    id: getMetadata(post, 'linkedId', null)
  };
}

/**
 * Vérifie si un post est épinglé
 */
export function isPinned(post) {
  return getMetadata(post, 'isPinned', false) === true;
}

/**
 * Vérifie si un post est verrouillé (pas de nouveaux comments)
 */
export function isLocked(post) {
  return getMetadata(post, 'isLocked', false) === true;
}

/**
 * Incrémente le compteur de vues d'un post
 */
export function incrementViewCount(post) {
  const currentCount = getMetadata(post, 'viewCount', 0);
  return setMetadata(post, { viewCount: currentCount + 1 });
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
    editedAt: null
  });
}

/**
 * Récupère l'ID du commentaire parent (null si commentaire de premier niveau)
 */
export function getParentCommentId(comment) {
  return getMetadata(comment, 'parentCommentId', null);
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
  return getMetadata(comment, 'isEdited', false) === true;
}

/**
 * Marque un commentaire comme édité
 */
export function markAsEdited(comment) {
  return setMetadata(comment, {
    isEdited: true,
    editedAt: new Date().toISOString()
  });
}

// ============ REACTIONS ============

/**
 * Emojis de réaction supportés
 */
export const REACTION_EMOJIS = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  HEART: '❤️',
  LAUGH: '😂',
  THINKING: '🤔',
  CELEBRATE: '🎉',
  EYES: '👀'
};

/**
 * Crée metadata pour une réaction
 * @param {Object} options - Options
 * @returns {Object} Metadata initialisé
 */
export function createReactionMetadata(options = {}) {
  return initMetadata({
    note: options.note || null // Note optionnelle pour contexte
  });
}

// ============ ACTIVITY LOG ============

/**
 * Types d'actions pour l'activity log
 */
export const ACTIVITY_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PIN: 'pin',
  UNPIN: 'unpin',
  LOCK: 'lock',
  UNLOCK: 'unlock',
  JOIN: 'join',
  LEAVE: 'leave',
  PROMOTE: 'promote',
  DEMOTE: 'demote'
};

/**
 * Types de ressources pour l'activity log
 */
export const RESOURCE_TYPES = {
  GROUP: 'group',
  POST: 'post',
  COMMENT: 'comment',
  REACTION: 'reaction',
  GROUP_MEMBER: 'group_member'
};

/**
 * Crée metadata pour une entrée d'activity log
 * @param {Object} details - Détails de l'action
 * @returns {Object} Metadata initialisé
 */
export function createActivityMetadata(details = {}) {
  return initMetadata(details);
}
