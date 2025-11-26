import { CONTACT_EMAIL } from "../constants";

export const ROLE_GUEST = "guest";
export const ROLE_USER = "user";
export const ROLE_ADMIN = "admin";
export const ROLE_ANONYMOUS = "anonymous";

export const ANONYMOUS_EMAIL = "anonymous@lepp.com";

/**
 * Get the role of a user
 * @param {Object} user - The user object from Supabase or useCurrentUser
 * @returns {string} - The role of the user
 */
export function getUserRole(user) {
  if (!user) {
    return ROLE_GUEST;
  }

  const email = user.email || user.profile?.email;
  if (email === ANONYMOUS_EMAIL) {
    return ROLE_ANONYMOUS;
  }
  if (email === CONTACT_EMAIL) {
    return ROLE_ADMIN;
  }

  return ROLE_USER;
}

/**
 * Check if a user can comment
 * @param {Object} user - The user object
 * @returns {boolean} - True if the user can comment
 */
export function canComment(user) {
  const role = getUserRole(user);
  return [ROLE_USER, ROLE_ADMIN, ROLE_ANONYMOUS].includes(role);
}

/**
 * Check if a user can write (vote, post, edit wiki, save chat)
 * @param {Object} user - The user object
 * @returns {boolean} - True if the user can write
 */
export function canWrite(user) {
  const role = getUserRole(user);
  return [ROLE_USER, ROLE_ADMIN].includes(role);
}
