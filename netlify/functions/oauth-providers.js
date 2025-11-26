import { PROVIDERS } from "../lib/oauthProviders.js";

export const handler = async (event) => {
  const enabledProviders = [];

  for (const [key, conf] of Object.entries(PROVIDERS)) {
    // Check if the Client ID environment variable is set and not empty
    if (process.env[conf.clientIdEnv]) {
      enabledProviders.push({
        id: key,
        name: conf.name,
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ providers: enabledProviders }),
  };
};
