import { getGitHubConfig, getConfigValue } from "../../common/config/instanceConfig.backend.js";

// Export synchrone pour rétrocompatibilité (utilise vault avec fallback env vars)
export const GITHUB_CONFIG = {
  owner: "jeanhuguesrobert",
  repo: "pertitellu",
  branch: "main",
  wikiPath: "wiki",
  get token() {
    return getConfigValue("github_token");
  },
};

// Export asynchrone pour utiliser le vault
export async function getGitHubConfigAsync() {
  return await getGitHubConfig();
}
