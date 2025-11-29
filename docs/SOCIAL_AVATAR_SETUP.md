# Configuration des Avatars Sociaux (OAuth)

Ce document explique comment configurer les fournisseurs d'identité (GitHub, Google) pour permettre
aux utilisateurs d'importer leur avatar.

## Vue d'ensemble

Le système utilise OAuth 2.0 pour récupérer l'avatar de l'utilisateur depuis des services tiers.
Pour que cela fonctionne, vous devez créer une "Application OAuth" sur chaque plateforme (GitHub,
Google) et configurer les identifiants obtenus dans les variables d'environnement de Netlify.

Le frontend détecte automatiquement quels fournisseurs sont configurés et n'affiche que les boutons
correspondants.

## Variables d'Environnement Requises

Ces variables doivent être définies dans **Site settings > Build & deploy > Environment >
Environment variables** sur Netlify (ou dans un fichier `.env` pour le développement local).

| Variable               | Description                                                                                                                                   |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL`         | L'URL racine de votre application (ex: `https://mon-app.netlify.app` ou `http://localhost:8888` en dev). **Important** pour les redirections. |
| `GITHUB_CLIENT_ID`     | Client ID de l'application GitHub.                                                                                                            |
| `GITHUB_CLIENT_SECRET` | Client Secret de l'application GitHub.                                                                                                        |
| `GOOGLE_CLIENT_ID`     | Client ID de l'application Google.                                                                                                            |
| `GOOGLE_CLIENT_SECRET` | Client Secret de l'application Google.                                                                                                        |

---

## 1. Configuration GitHub

1.  Allez sur [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
2.  Cliquez sur **New OAuth App**.
3.  Remplissez le formulaire :
    - **Application Name** : Le nom de votre app (ex: "Kudocracy Avatar").
    - **Homepage URL** : `https://votre-site.netlify.app` (ou `http://localhost:8888` pour dev).
    - **Authorization callback URL** : `https://votre-site.netlify.app/oauth/github/callback` (ou
      `http://localhost:8888/oauth/github/callback`).
4.  Cliquez sur **Register application**.
5.  Copiez le **Client ID**.
6.  Générez un **Client Secret** et copiez-le.
7.  Ajoutez ces valeurs dans vos variables d'environnement Netlify :
    - `GITHUB_CLIENT_ID`
    - `GITHUB_CLIENT_SECRET`

## 2. Configuration Google

1.  Allez sur la [Google Cloud Console](https://console.cloud.google.com/).
2.  Créez un nouveau projet ou sélectionnez-en un existant.
3.  Allez dans **APIs & Services > Credentials**.
4.  Cliquez sur **Create Credentials** > **OAuth client ID**.
5.  Si demandé, configurez l'écran de consentement (OAuth consent screen) :
    - Type : **External**.
    - Remplissez les infos obligatoires (Nom, emails support).
    - Scopes : Ajoutez `.../auth/userinfo.profile` et `.../auth/userinfo.email`.
6.  Revenez à la création d'identifiants :
    - Application type : **Web application**.
    - **Authorized JavaScript origins** : `https://votre-site.netlify.app` (et
      `http://localhost:8888` pour dev).
    - **Authorized redirect URIs** : `https://votre-site.netlify.app/oauth/google/callback` (et
      `http://localhost:8888/oauth/google/callback`).
7.  Cliquez sur **Create**.
8.  Copiez le **Client ID** et le **Client Secret**.
9.  Ajoutez ces valeurs dans vos variables d'environnement Netlify :
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`

## Notes Importantes

- **Redirections** : Assurez-vous que les URLs de callback configurées chez les providers
  correspondent _exactement_ à ce que votre application envoie. Le backend construit l'URL de
  redirection ainsi : `${APP_BASE_URL}/oauth/{provider}/callback`.
- **Sécurité** : Ne committez jamais vos secrets (`CLIENT_SECRET`) dans le code source. Utilisez
  toujours les variables d'environnement.

## Tester en Local

Pour tester le flux OAuth sur votre machine avant de déployer :

1.  **Netlify CLI** : Assurez-vous d'avoir installé Netlify CLI (`npm install -g netlify-cli`).
2.  **Fichier .env** : Créez un fichier `.env` à la racine du projet (il est ignoré par git) et
    mettez-y vos variables :
    ```env
    APP_BASE_URL=http://localhost:8888
    GITHUB_CLIENT_ID=...
    GITHUB_CLIENT_SECRET=...
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    ```
3.  **Configuration Providers** :
    - **GitHub** : Vous ne pouvez pas avoir plusieurs URLs de callback par app. Créez une **seconde
      app GitHub** dédiée au dev (ex: "Kudocracy Dev") avec
      `http://localhost:8888/oauth/github/callback`.
    - **Google** : Vous pouvez ajouter plusieurs URIs de redirection dans la même app. Ajoutez
      simplement `http://localhost:8888/oauth/google/callback` à la liste existante dans la console
      Google.
4.  **Lancer** : Exécutez `netlify dev`.
    - Cela lance le frontend (Vite) et le backend (Functions) ensemble.
    - Accédez à `http://localhost:8888`.

> [!NOTE] **Pourquoi localhost ?** `localhost` (ou `127.0.0.1`) fait référence à votre ordinateur
> lui-même. Cette adresse ne change **jamais**, même si vous changez de réseau Wi-Fi ou si votre
> adresse IP publique change. C'est pour cela qu'elle est idéale pour le développement. Le
> fournisseur OAuth (GitHub/Google) n'a pas besoin de "voir" votre ordinateur ; il demande
> simplement à votre navigateur de rediriger vers cette adresse locale.
