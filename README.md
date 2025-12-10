# 📊 Kudocracy.Survey - Plateforme de Consultation Citoyenne

Kudocracy.Survey is a generic open-source platform for citizen consultation and participatory
democracy, reusable by any municipality or collective worldwide. It belongs to the Kudocracy family
of projects.

The Corte (Corsica) deployment is the first real-world pilot.
[![Netlify Status](https://api.netlify.com/api/v1/badges/e01f01b7-130b-4749-abc7-7b81cfd591e0/deploy-status)](https://app.netlify.com/projects/lucky-concha-a9fcd2/deploys)

## Neutrality & Scope

Kudocracy is a neutral open-source infrastructure.

It does not fund, promote or support:

- any political party
- any electoral campaign
- any candidate or list

It provides digital tools that may be used by any citizen, collective or institution.

--

## Pilote à Corte

A l'occasion des futures élections municipales, la plateforme sera utilisé pour la première fois en
production. L'agent IA Ophélia est utilisé pour répondre aux questions des citoyens en faisant
figure de candidate citoyenne virtuelle.

> Prototype disponible sur [LePP.fr](https://lepp.fr/)

Kudocracy.Survey est une plateforme numérique conçue pour renforcer la démocratie participative
locale. Elle permet aux citoyens de donner leur avis, de proposer des idées et de participer
activement à la vie de leur commune ou communauté.

---

## 🎯 À quoi ça sert ?

Kudocracy.Survey rassemble plusieurs espaces complémentaires. Chacun s'adresse à un usage simple du
quotidien : discuter, s'informer, voter ou s'organiser.

### 1. ☕ Café — Discuter entre voisins

Le Café est un lieu convivial où les habitants créent des groupes par quartier, par association ou
par thème. On y publie des messages courts ou de vrais billets, on réagit avec des emojis, on suit
les conversations qui nous intéressent et on peut se présenter grâce à un profil public. Tout est
pensé pour rendre les échanges lisibles et bienveillants.

### 2. 💬 Ophélia — Une assistante qui répond

Ophélia est l'IA de la plateforme. Elle répond en français aux questions des citoyens, aide à
formuler une idée, guide vers les démarches utiles et relit les propositions avant publication. Plus
vous nourrissez le wiki et les consultations, plus ses réponses sont pertinentes.

### 3. 📖 Wiki collaboratif — La mémoire commune

Le wiki sert de carnet de bord collectif : comptes rendus, fiches pratiques, idées de quartier… La
recherche est instantanée et l'interface reste simple, même pour une première contribution. Chaque
page indique son auteur, ses dates de mise à jour et peut être partagée en un clic.

### 4. 🗳️ Kudocratie — Débattre et voter

Cette section permet de déposer une proposition, de voter pour ou contre et, si l’on préfère, de
déléguer sa voix à quelqu’un de confiance sur un sujet précis. Les citoyens suivent l’avancée des
propositions en temps réel et voient quels thèmes mobilisent la communauté.

### 5. 📊 Consultations — Prendre le pouls

Les enquêtes recueillent des avis rapides sur les projets locaux. Elles s’adaptent à un quartier,
une association ou une ville entière. Les résultats sont anonymes, présentés sous forme de
graphiques lisibles et peuvent alimenter les décisions publiques.

### 6. 🔍 Transparence — Comprendre comment la ville décide

Un tableau de bord synthétise les engagements de transparence : comptes rendus publiés, accès aux
archives, participation aux conseils… Les habitants comparent leur territoire à d'autres et suivent
les progrès dans le temps.

### 7. 📰 La Gazette — Raconter l'actualité locale

La Gazette reprend les codes d'un journal papier : rubriques hebdomadaires, articles illustrés, ton
chaleureux. Les membres du collectif peuvent devenir rédacteurs, publier des chroniques et renvoyer
vers le Café pour poursuivre la discussion.

---

## ✨ Fonctionnalités supplémentaires

- **Audit de transparence** : pour évaluer le respect du public lors des conseils municipaux
- **Liens vers des services externes** : signalement d'incidents urbains, agenda social, entraide
  bénévole
- **Configuration adaptable** : la plateforme peut être personnalisée pour n'importe quelle commune
  ou mouvement citoyen

---

## 🚀 Comment l'utiliser ?

### Pour les citoyens (utilisateurs)

1. **Visitez le site** : [lepp.fr](https://lepp.fr/)
2. **Explorez sans compte** : la plupart des contenus sont accessibles sans inscription
3. **Créez un compte** (optionnel) pour :
   - Discuter avec Ophélia
   - Proposer et voter sur des idées (Kudocratie)
   - Contribuer au wiki

### Pour les développeurs et techniciens

#### Prérequis

- Node.js version 18 ou supérieure
- Un compte Supabase (base de données)
- Netlify CLI (pour les fonctions serverless)

#### Installation locale

```bash
# 1. Cloner le projet
git clone <url-du-depot>
cd survey

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditez le fichier .env avec vos propres clés API
# Note: Le projet utilise un système de "vault" centralisé qui permet de stocker
# la configuration en base de données. Voir docs/CONFIGURATION_VAULT.md pour plus de détails.

# 4. Lancer en mode développement
netlify dev
```

L'application sera accessible sur `http://localhost:8888`

---

### CLI : Tests RAG & SQL

Le script `scripts/rag_chat_cli.js` fournit deux modes utiles pour les développeurs :

- **Mode RAG (par défaut)** :

  ```bash
  node scripts/rag_chat_cli.js "Question pour Ophélia" --top 8 --fetch-limit 1500 --json
  ```

  - Requiert `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  - `--top` ajuste le nombre de chunks retournés (5 par défaut).
  - `--fetch-limit` limite le nombre total de chunks téléchargés depuis Supabase.
  - `--json` affiche une réponse structurée (sinon le script rend un format humain).

- **Mode SQL direct** :

  ```bash
  RAG_SQL_ENDPOINT=https://<votre-site>/api/chat-stream \
  CLI_TOKEN=<token aligné sur Netlify> \
  node scripts/rag_chat_cli.js --sql "SELECT id, title FROM wiki_pages ORDER BY updated_at DESC" --limit 50 --json
  ```

  - Utilise le short-cut `?sql=` de l'edge function pour exécuter `sql_query` sans passer par le
    LLM.
  - Variables utiles :
    - `RAG_SQL_ENDPOINT` (URL complète) ou `RAG_CHAT_ENDPOINT`/`URL` (base, `/api/chat-stream` sera
      ajouté).
    - `CLI_TOKEN` pour l'entête `x-cli-token` (doit correspondre à `CLI_TOKEN` côté Netlify).
    - `SQL_AUTH_TOKEN` ou `SUPABASE_JWT` si l'autorisation doit se faire via
      `Authorization: Bearer`.
  - Options :
    - `--sql "SELECT …"` ou `--sql-file ./ma-requete.sql`.
    - `--limit 200` pour surcharger la limite côté outil (100 par défaut).
    - `--format markdown` pour un tableau prêt à copier-coller (sinon JSON).
    - `--endpoint`, `--cli-token`, `--auth` pour surcharger l'environnement sans modifier `.env`.

Ce flux permet de valider localement le format JSON enrichi de `sql_query` (métadonnées, comptage,
erreurs détaillées) sans démarrer d'interface web.

---

## 🛠️ Technologies utilisées

**Pour les curieux et les développeurs :**

- **Frontend** : React 18 avec Vite (rapide et moderne)
- **Routage** : React Router v6
- **Design** : Tailwind CSS pour un look moderne et responsive
- **Base de données** : Supabase (PostgreSQL)
- **Graphiques** : Recharts
- **Rendu Markdown** : react-markdown avec support GitHub Flavored Markdown
- **IA** : Support OpenAI, Hugging Face, Anthropic et autres
- **Hébergement** : Netlify (avec fonctions serverless)

---

## 📅 Dernières améliorations (Fin Novembre 2025 - v1.3.0)

### 🤖 Ophélia V2 (Assistant "Bob" IA optimisé pour la ville de Corte)

- ✨ **Nouvelle Interface (UI v2)** : Design modernisé et plus intuitif.
- ✨ **Mode "Raisonnement"** : Affichage du processus de pensée (`<Think>`) pour des réponses plus
  transparentes.
- ✨ **Widget d'intégration** : Possibilité d'intégrer Ophélia sur des sites web externes (en
  cours).
- ✨ **RAG Avancé** : Ingestion de documents via Google Gemini 3.0 et Supabase Storage pour des
  réponses plus précises (en cours).
- ✨ **Connaissance Locale** : Amélioration du prompt sur les quartiers de Corte.
- 🔧 **API & Intégrations** : Nouvelle API Javascript et développement d'un serveur MCP (Model
  Context Protocol) (en cours).

### 💾 Données & Fonctionnalités

- ✨ **Flux de Données** : Nouvelles tables pour l'intégration de flux type RSS et données externes.
- ✨ **Gestion Documentaire** : Amélioration du stockage et du traçage des documents sources
  (`document_source`).
- ✨ **Expérience Utilisateur** : Page de contact, édition de posts améliorée, et corrections sur
  les réactions.

### Système d'abonnements universel

- ✨ **Abonnez-vous à n'importe quel contenu** : posts, propositions, pages wiki
- ✨ **Fil d'abonnements personnalisé** avec filtres par type de contenu
- ✨ **Compteur d'abonnés** visible sur chaque contenu

### Café Pertitellu & Profils

- ✨ **Espace social complet** : forums, blogs, quartiers, associations
- ✨ **Page de profil dédiée** avec gestion des informations personnelles
- ✨ **Hook `useUserProfile`** pour une gestion unifiée des données utilisateur

### 📆 Agenda & Centre Incidents

- ✨ **Nouvelles pages dédiées** `/agenda` et `/incidents` regroupent toutes les publications de
  type événement/incident issues du Café Pertitellu.
- ✨ **Double mode liste ↔ carte** grâce à `CitizenMap`, avec calques spécialisés (`EventsLayer`,
  `IncidentsLayer`) pour visualiser la cartographie des déclarations.
- ✨ **Filtres par Gazette** et tri chronologique/critique pour isoler rapidement les rendez-vous
  citoyens, les incidents actifs et ceux résolus.
- ✨ **Contributions citoyennes sur la géolocalisation** : un modal permet d'ajouter ou corriger les
  coordonnées d'un événement/incident, instantanément reflété dans la carte.

### 🧭 Missions & Tâches Kanban

- ✨ **Lien missions ↔ projets de tâches** : chaque projet Kanban (`/tasks/:id`) peut pointer vers
  une mission (`linked_mission_id`) et remonter l'état côté mission.
- ✨ **Tableau de bord utilisateur enrichi** : la page `/user-dashboard` affiche désormais les
  missions rejointes et les tâches assignées (statut, projet d'origine) pour l'utilisateur courant.
- ✨ **Badges contextuels** : les cartes mission/tâche indiquent lieu, statut et accès direct aux
  pages `/missions/:id` ou aux cartes Kanban.
- ✨ **Statistiques consolidées** : les compteurs missions/tâches alimentent les sections « Actions
  rapides » et les CTA du dashboard afin d'encourager l'engagement.

---

## 🗂️ Structure du projet

```
survey/
├── netlify/
│   ├── functions/          # Fonctions serverless classiques
│   └── edge-functions/     # Fonctions Edge (IA streaming, RAG)
├── public/
│   ├── prompts/            # Configuration de l'assistant IA
│   └── docs/               # Documents publics (audit éthique, annonces, etc.)
├── src/
│   ├── components/
│   │   ├── bob/           # Interface de l'assistant Ophélia (v1 & v2)
│   │   ├── common/        # Composants réutilisables (AuthModal, UserDisplay, SubscribeButton, etc.)
│   │   ├── kudocracy/     # Système de propositions et votes
│   │   ├── layout/        # Layouts (SiteFooter, etc.)
│   │   ├── social/        # Composants du Café Pertitellu
│   │   └── wiki/          # Composants du wiki
│   ├── pages/             # Pages de l'application
│   │   ├── Social.jsx     # Page principale du Café Pertitellu
│   │   ├── GroupPage.jsx  # Page d'un groupe
│   │   ├── PostPage.jsx   # Page d'une publication
│   │   ├── UserProfile.jsx # Profil utilisateur
│   │   ├── SubscriptionFeed.jsx # Fil des abonnements
│   │   └── ...
│   ├── lib/               # Utilitaires et helpers
│   │   ├── supabase.js    # Client Supabase et hooks d'authentification
│   │   ├── useUserProfile.js # Hook pour gérer les profils
│   │   ├── useSubscription.js # Hook pour gérer les abonnements
│   │   └── socialMetadata.js # Métadonnées pour le système social
│   └── config/            # Configuration (questionnaires, critères transparence)
├── supabase/
│   ├── schema.sql         # Schéma de base de données
│   └── migrations/        # Migrations SQL
└── README.md              # Ce fichier
```

---

## ⚙️ Configuration personnalisée

La plateforme est **générique et adaptable** à n'importe quelle commune ou communauté. Vous pouvez
personnaliser :

- Le nom de votre commune (ex: `Corte`)
- Le nom de votre mouvement (ex: `Pertitellu`)
- Le nom de l'assistant IA (ex: `Ophélia`)
- Les couleurs et le logo
- Les questions des consultations

Toute la configuration se fait via le fichier `.env` ou via le **vault** en base de données.
Consultez `.env.example` pour les variables disponibles et `docs/CONFIGURATION_VAULT.md` pour le
système de configuration centralisée.

---

## 🧭 Engagement pour la transparence

Cette plateforme participe à l'initiative citoyenne **"Transparence"** qui vise à :

- Rendre les consultations locales **lisibles et compréhensibles** par tous
- Garantir l'**auditabilité** des données
- Favoriser la **comparaison** entre territoires
- Encourager la **publication responsable** des résultats

**Respect de vos données :**

- Aucune donnée sensible collectée
- Anonymisation des réponses
- Conformité RGPD stricte
- Email optionnel uniquement si vous souhaitez être recontacté

---

## 🔮 À venir

- 🔄 **Abonnements wiki** : suivre les modifications des pages wiki
- 🔄 **Notifications** pour les nouveaux contenus du Café
- 🔄 **Messagerie publique** entre utilisateurs
- 🔄 **Système de badges** pour récompenser l'engagement citoyen
- 🔄 Recherche avancée dans le wiki
- 🔄 Export PDF des résultats
- 🔄 Carte interactive des propositions locales
- 🔄 Tableau de bord "Transparence" national
- 🔄 **Intégration calendrier** pour les événements du Café

---

## 💰 Financement & Association C.O.R.S.I.C.A.

Survey est un **commun numérique open source** porté par l'association loi 1901 **C.O.R.S.I.C.A.**
(Corse Organisant la Réunion Sur Internet de Compétences Autonomes).

### 💚 Faire un don

Le projet est **100% gratuit** et financé exclusivement par les dons :

En cours de mise en place :

👉 **[HelloAsso](https://www.helloasso.com/associations/corsica)** (plateforme principale, 0%
commission)

Autres plateformes : [Open Collective](https://opencollective.com/kudocracy) •
[Liberapay](https://liberapay.com/)

### Ce que votre soutien finance

- Hébergement & infrastructure (~700€/an)
- APIs IA et embeddings (~200€/an)
- Noms de domaine (~50€/an)
- Sécurité & audits

### Ce que Survey ne finance jamais

- ❌ Aucune campagne politique
- ❌ Aucune liste électorale
- ❌ Aucune action partisane

Kudocracy.Survey est une **infrastructure open source neutre**, réutilisable par tous.

👉 Voir [FUNDING.md](FUNDING.md) pour tous les détails.

---

## 🗳️ Municipales 2026 : Engagez-vous !

À l'approche des élections municipales, la plateforme permet aux **listes électorales** de démontrer
leur engagement concret pour la transparence **avant même d'être élues**.

### Comment ça marche ?

1. **Signez la Charte Transparence** (8 engagements mesurables)
2. **Déployez une instance** pour votre liste/commune
3. **Publiez vos données** et répondez aux citoyens
4. **Comparez votre score** avec les autres listes

👉 **[S'engager pour la transparence](/engagement)**

👉 **[Voir les communes engagées](/transparence/communes)**

---

## 📜 Licence

**MIT** - Projet open-source pour la démocratie locale

---

## 🤝 Contact et contribution

**Initiative #PERTITELLU - Corti Capitale**

📧 Email : [jean_hugues_robert@yahoo.com](mailto:jean_hugues_robert@yahoo.com) 🌐 Site :
[lepp.fr](https://lepp.fr/)

**Vous souhaitez contribuer ?**

- Testez la plateforme et signalez les bugs
- Proposez des améliorations via GitHub Issues
- Partagez la plateforme dans votre commune
- Contactez-nous pour adapter Kudocracy.Survey à votre territoire

---

## 📖 Annexes techniques

<details>
<summary><strong>Système de Configuration Centralisé (Vault)</strong></summary>

Le projet utilise un système de configuration centralisé qui permet de :

- Stocker la configuration en base de données (table `instance_config`)
- Avoir un fallback automatique vers les variables d'environnement
- Gérer des valeurs par défaut cohérentes

### Ordre de priorité

1. **Vault** (base de données Supabase)
2. **Variables d'environnement** (`.env` ou Netlify)
3. **Valeurs par défaut** (définies dans le code)

### Modules disponibles

- `src/lib/instanceConfig.js` — Frontend React
- `netlify/lib/instanceConfig.js` — Netlify Functions (Node.js)
- `netlify/edge-functions/lib/instanceConfig.js` — Edge Functions (Deno)
- `scripts/lib/config.js` — Scripts CLI

### Utilisation

```javascript
import { loadConfig, getConfigValue } from "./lib/instanceConfig.js";

await loadConfig();
const apiKey = getConfigValue("openai_api_key");
const cityName = getConfigValue("city_name", "Corte");
```

Voir `docs/CONFIGURATION_VAULT.md` pour la documentation complète.

</details>

<details>
<summary><strong>Configuration des providers IA</strong></summary>

### OpenAI

```bash
OPENAI_API_KEY=votre_clé
OPENAI_SMALL_MODEL=gpt-4o-mini
OPENAI_HEAVY_MODEL=gpt-4o
```

### Hugging Face

```bash
HUGGINGFACE_API_KEY=votre_clé
HUGGINGFACE_CHAT_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
```

Si `OPENAI_API_KEY` est défini, OpenAI est utilisé en priorité.

</details>

<details>
<summary><strong>Configuration Supabase</strong></summary>

### Tables principales

- `users` : profils utilisateurs (display_name, neighborhood, interests, etc.)
- `content_subscriptions` : abonnements aux contenus (posts, propositions, wiki)
- `groups` : groupes du Café Pertitellu (forums, blogs, quartiers, associations)
- `posts` : publications dans les groupes
- `comments` : commentaires sur les publications
- `reactions` : réactions (👍 ❤️ etc.) sur posts et commentaires
- `group_members` : membres des groupes
- `read_tracking` : suivi de lecture des posts
- `activity_log` : journal d'activité
- `wiki_pages` : pages du wiki
- `propositions` : propositions citoyennes
- `tags` : étiquettes pour les propositions
- `votes` : votes des utilisateurs
- `delegations` : délégations de vote
- `municipal_transparency` : données de transparence des communes

### Métadonnées JSONB

Toutes les tables principales utilisent une colonne `metadata` au format JSONB avec `schemaVersion`
pour faciliter les évolutions futures :

```json
{
  "schemaVersion": 1,
  "customField": "valeur"
}
```

Pensez à configurer les règles RLS (Row Level Security) selon vos besoins.

</details>

<details>
<summary><strong>Commandes utiles</strong></summary>

```bash
# Lancer en développement
netlify dev

# Build de production
npm run build

# Lister les variables d'environnement
netlify env:list

# Migrations Supabase
supabase db diff
```

</details>

---

**Fait avec ❤️ pour la démocratie participative**
