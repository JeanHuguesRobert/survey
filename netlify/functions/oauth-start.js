import { PROVIDERS } from "../lib/oauthProviders.js";

export const handler = async (event) => {
  const { provider } = event.queryStringParameters;
  const conf = PROVIDERS[provider];

  if (!conf) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid provider" }),
    };
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:8888";
  const redirectUri = `${appBaseUrl}${conf.redirectPath}`;

  // TODO: Generate a random state and store it (e.g. in a cookie or DB) to prevent CSRF
  const state = "TODO_GENERATE_RANDOM_STATE";

  const params = new URLSearchParams({
    client_id: process.env[conf.clientIdEnv],
    redirect_uri: redirectUri,
    response_type: "code",
    scope: conf.scopes.join(" "),
    state: state,
  });

  // Google requires access_type=offline to get refresh token if needed,
  // but for just avatar we might not need it.
  // However, include_granted_scopes=true is good practice for Google.
  if (provider === "google") {
    params.append("include_granted_scopes", "true");
  }

  const authUrl = `${conf.authorizeUrl}?${params.toString()}`;

  return {
    statusCode: 200,
    body: JSON.stringify({ authUrl }),
  };
};
