export const GITHUB_CONFIG = {
  owner: 'jeanhuguesrobert',
  repo: 'pertitellu',
  branch: 'main',
  wikiPath: 'wiki',
  token: process.env.GITHUB_TOKEN
};

export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};
