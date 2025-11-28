# Facebook OAuth & Supabase setup

This document explains how to create a Facebook App, get the App ID and App Secret, and where to put
them so the app's Facebook sign-in works.

1. Create a Facebook App

- Go to https://developers.facebook.com/ and sign in.
- Click "My Apps" → "Create App" → choose "Consumer" (or the appropriate type) → give it a name and
  create.

2. Get App ID & App Secret

- In the app dashboard open **Settings > Basic**.
- Copy the **App ID** and click **Show** on **App Secret** to copy it.

3. Configure OAuth redirect URIs

- In the left sidebar add the product **Facebook Login** (if not already) and open **Facebook
  Login > Settings**.
- In **Valid OAuth Redirect URIs** add the Supabase callback for your project (required):
  - `https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1/callback`

Note: your `SUPABASE_PROJECT` is the subdomain portion of your Supabase URL. Example:

- If `VITE_SUPABASE_URL=https://xyz.supabase.co` then your project id is `xyz` and the callback is:
  - `https://xyz.supabase.co/auth/v1/callback`

Quick code snippet to derive it locally (for reference only — don't display this in the UI):

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // e.g. "https://xyz.supabase.co"
const supabaseProject = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : null;
// supabaseProject === 'xyz'
```

Keep this value private when appropriate; you only need it to register redirect URIs on Facebook and
in Supabase settings.

- If you also use the repo's backend OAuth (avatar import via Netlify Functions), add the backend
  callback URIs used by the functions (the backend builds redirect URIs as
  `${APP_BASE_URL}/oauth/facebook/callback`):
  - Production: `https://<YOUR_SITE_DOMAIN>/oauth/facebook/callback`
  - Local dev (Netlify dev): `http://localhost:8888/oauth/facebook/callback`

- Also add your local dev URL if you want Facebook to accept it for testing (optional):
  - `http://localhost:5173/` (or your dev origin)

4. Configure Supabase

- Open your Supabase project dashboard → Authentication → Settings → External OAuth Providers.
- Enable **Facebook** and paste the **App ID** and **App Secret** you obtained.
- Save.

5. Environment variables (client & server)

- For the _client app_ (used to decide whether to show the Facebook sign-in button), add to your
  frontend environment file (for Vite use `.env` / `.env.local`):

  VITE_FACEBOOK_APP_ID=your_facebook_app_id

  This is intentionally _only_ to toggle UI visibility; the real OAuth flow uses the App ID/Secret
  configured in Supabase.

- For the _server or deployment settings_ (if you run any backend auth route), store the secret
  securely in your host's environment variables or a `.env` used by the backend:

  FACEBOOK_CLIENT_ID=your_facebook_client_id FACEBOOK_CLIENT_SECRET=your_facebook_client_secret
  APP_BASE_URL=https://your-site.netlify.app # used by Netlify functions to build redirect URIs

  (Exact names depend on your backend code; use the names your backend expects.)

6. Redirect URLs and production

- Ensure your production origin is registered where needed:
  - On Facebook App settings (Site URL / Valid OAuth Redirect URIs)
  - In Supabase (the callback provided above)
  - In your deployment provider (Netlify/Vercel) set the environment variables accordingly.

7. Testing locally

- Start your app: `npm run dev` (or your usual command).
- Make sure `.env` contains `VITE_FACEBOOK_APP_ID`.
- Open the auth modal — the Facebook button appears only when `VITE_FACEBOOK_APP_ID` is present.
- Click the button: you should be redirected to Facebook and then back via Supabase's callback URL.

Notes

- For security, do not commit secrets to the repo. Use deployment provider env vars for production.
- Supabase acts as the OAuth intermediary; you must set the App ID/Secret in Supabase's provider
  settings (step 4).

If you want, I can also:

- Add example `.env.example` values to the repo.
- Update any backend auth route to read `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` explicitly.
- Help set Netlify/Vercel environment variables with exact names used by your backend.

---

**Client-side Facebook SDK (optional)**

- Purpose: load the Facebook JS SDK only when you need client-side Facebook features (Share dialogs,
  FB.api, social plugins). This is independent from OAuth authentication handled by Supabase or your
  backend.
- Show the button / load the SDK only when `VITE_FACEBOOK_APP_ID` is set in your frontend env.
- Minimal conditional injection (place in `src/main.jsx` or after app mount):

```javascript
const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
if (FB_APP_ID) {
  window.fbAsyncInit = function () {
    FB.init({ appId: FB_APP_ID, cookie: true, xfbml: true, version: "v16.0" });
    FB.AppEvents.logPageView();
  };
  (function (d, s, id) {
    if (d.getElementById(id)) return;
    const js = d.createElement(s);
    js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    d.getElementsByTagName(s)[0].parentNode.insertBefore(js, d.getElementsByTagName(s)[0]);
  })(document, "script", "facebook-jssdk");
}
```

- CSP: ensure `connect.facebook.net` (and `www.facebook.com` if using widgets) are allowed in your
  Content-Security-Policy. Your `netlify.toml` already allows `*.facebook.com` but confirm
  `connect.facebook.net` is covered.
- Security: never expose your App Secret to the client. The SDK uses the App ID only.

---

**Data deletion callback (obligation de la plateforme Meta)**

Meta exige que votre application implémente un "data deletion callback" pour permettre aux
utilisateurs de demander la suppression de leurs données via Facebook. Configurez l'URL de rappel de
suppression de données dans le tableau de bord de l'App (Data Deletion Request Callback URL).

1. Exemple d'URL à définir dans le champ de l'App (Facebook App Settings → Data Deletion Request
   Callback URL):

https://lepp.fr/.netlify/functions/facebook-data-deletion

2. Comportement attendu du callback:

- Recevoir une requête POST contenant `signed_request` (x-www-form-urlencoded).
- Valider la signature avec votre `FACEBOOK_CLIENT_SECRET`.
- Lancer la suppression des données liées à `user_id` (ou planifier la suppression) côté serveur.
- Répondre immédiatement avec un JSON contenant `url` et `confirmation_code` comme ci‑dessous:

```json
{
  "url": "https://lepp.fr/oauth/facebook/deletion-status?code=abc123",
  "confirmation_code": "abc123"
}
```

3. Exemple d'implémentation (Netlify Function)

- Le projet contient un exemple prêt à l'emploi: `netlify/functions/facebook-data-deletion.js`.
- Il vérifie `signed_request` (HMAC-SHA256) en utilisant `FACEBOOK_CLIENT_SECRET` et renvoie `url` +
  `confirmation_code`.

4. Page de suivi / statut

- Vous devez fournir une page publique à l'URL retournée (`/oauth/facebook/deletion-status`) qui
  affiche le statut de la demande lorsque l'utilisateur saisit ou suit `confirmation_code`.
- Exemple minimal: affichez une page expliquant que la demande est en cours de traitement et montrez
  le `confirmation_code`.

5. Variables d'environnement à définir (Netlify ou autre environnement de fonctions):

- `FACEBOOK_CLIENT_SECRET` : utilisé pour vérifier `signed_request`.
- `APP_BASE_URL` : utilisé pour construire `url` de statut (ex: `https://lepp.fr`).

Notes

- Ne lancez pas automatiquement des suppressions irréversibles sans procédure interne de
  vérification/rétention si vos règles RGPD l'exigent.
- Vous pouvez utiliser `SUPABASE_SERVICE_ROLE_KEY` pour effectuer des suppressions côté base de
  données si vous avez une table dédiée et des règles claires. Le code de la fonction contient un
  TODO pour intégrer la logique de suppression.
