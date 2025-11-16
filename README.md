# 📊 Survey. Consultation Citoyenne Petit Parti / Pertitellu

Une plateforme de consultation citoyenne pour les élections municipales de Corte ou ailleurs, incluant une IA conversationnelle, un wiki collaboratif et un système de propositions citoyennes (Kudocratie).

Disponible en version [Prototype LePP.fr](http://lepp.fr/)

## 🚀 Fonctionnalités principales

### 1. Consultation citoyenne
- Questionnaire sur la démocratie locale (adaptable à toute communauté)
- **Nouvelle question** : Les horaires actuels des conseils municipaux vous paraissent-ils pratiques ?
- Visualisation en temps réel des résultats (graphiques interactifs)
- Partage social et anonymisation des réponses

### 2. Wiki collaboratif
- **Navigation intuitive** : liste des pages, recherche par adresse
- **Édition/Création** : routes dédiées `/wiki/new` et `/wiki/:slug/edit`
- **Rendu Markdown** : support H1-H6, listes, citations, liens internes/externes, code
- **Navigation contextuelle** : boutons précédent/suivant entre les pages
- **Partage social** : API Web Share + copie dans le presse-papier
- **Résumé automatique** : chaque page wiki reçoit un résumé lors de l'archivage

### 3. Kudocratie (Propositions citoyennes)
- Création et vote de propositions
- Délégation de vote sur des sujets spécifiques
- Tableau de bord des résultats
- Description en Markdown (GFM) avec liens internes vers le wiki
- Système de tags dynamique (création et suggestion de tags)

### 4. Assistant IA « Bob »
- Assistant conversationnel en français
- Prompt système public (`public/prompts/bob-system.md`) chargeable via env ou fichier
- Création de propositions et tags à la demande
- Création de pages dans le wiki à la demande
- Résumés et consolidation du wiki intégrés dans le prompt pour améliorer la pertinence

### 4. Transparence & participation renforcée
- **Enquête Transparence** : sur le respect du public lors des conseils municipaux
- **Engagement collectif** : publication des audits, engagements éthiques et résultats de consultation
- **IA pour tous** *(en expérimentation)* : programme d’expérimentation citoyenne sur l’IA conversationnelle

### 5. Services additionnels, externes
- Signalement d’incidents urbains
- Agenda social partagé
- Plateforme d’entraide bénévole
- Accès direct aux réseaux sociaux du mouvement

## 🛠️ Stack technique

- **Frontend** : React 18 + Vite
- **Routing** : React Router v6
- **Styles** : Tailwind CSS + CSS modules
- **Backend** : Supabase (PostgreSQL)
- **Graphiques** : Recharts
- **Markdown** : react-markdown + remark-gfm
- **Markdown (Bob)** : marked + DOMPurify
- **Serverless** : Netlify Functions (API, IA, consolidation wiki, etc.)

## 📁 Structure du projet

Structure du projet (extrait)
```
\survey
├─ .env                              # variables d'environnement locales (ne pas committer)
├─ package.json                      # dépendances & scripts (installer à la racine)
├─ netlify/
│  └─ functions/
│     ├─ rag_chatbot.js              # Netlify Function : RAG chatbot (HF / OpenAI)
│     ├─ optimize-wiki-title.js      # Netlify Function : optimisation titre/slug
│     ├─ consolidate-wiki.js         # Netlify Function : consolidation/résumé du wiki
│     └─ ...                         # autres fonctions serverless
├─ public/                           # assets statiques (favicon, images, prompts, docs...)
│  ├─ prompts/
│  │   └─ bob-system.md              # prompt système de Bob (assistant IA)
│  ├─ docs/
│  │   └─ audit-ethique.md           # audit éthique, autres documents publics
│  └─ ...                            # autres fichiers statiques
├─ src/
│  ├─ components/
│  │  ├─ bob/
│  │  │  ├─ ChatWindow.jsx           # UI du chatbot — disclaimer ajouté ici
│  │  │  └─ ...                      # autres composants Bob
│  │  ├─ common/
│  │  │  ├─ AuthModal.jsx
│  │  │  └─ ...                      # composants communs (modaux, etc.)
│  │  ├─ layout/
│  │  │  ├─ SiteFooter.jsx           # footer (showWiki flag)
│  │  │  └─ ...                      # layout/navigation
│  │  ├─ LegalLinks.jsx              # liens légaux
│  │  ├─ AuditContent.jsx            # contenu audit éthique
│  │  └─ ...                         # autres composants
│  ├─ lib/
│  │  ├─ supabase.js                 # client Supabase
│  │  ├─ propositions.js             # helpers création propositions
│  │  ├─ linkifyWardWiki.js          # utilitaire linkification WikiWords
│  │  └─ ...                         # autres helpers/lib
│  ├─ config/
│  │  └─ questionnaireModules.js     # modules de questionnaire par type de communauté
│  ├─ constants.js                   # constantes partagées (CITY_NAME, BOT_NAME, APP_VERSION...)
│  ├─ pages/
│  │  ├─ Wiki.jsx                    # page d'accueil du wiki
│  │  ├─ WikiPage.jsx                # page wiki individuelle
│  │  ├─ Proposition.jsx             # détail d'une proposition
│  │  ├─ Contact.jsx                 # page contact
│  │  └─ ...                         # autres pages (Accueil, Résultats, etc.)
│  ├─ App.jsx                        # composant racine React
│  ├─ main.jsx                       # point d'entrée React
│  └─ index.css                      # styles globaux (inclut .markdown-content)
├─ README.md                         # documentation du projet
└─ ...                               # autres fichiers / dossiers (scripts, tests, etc.)
```



## 🚀 Installation et déploiement

### Prérequis
- Node.js ≥ 18
- npm
- Compte Supabase
- Netlify CLI (pour le développement local des fonctions serverless)

### Installation locale
```bash
# Cloner le projet
git clone <repo-url>
cd survey

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# → Personnalisez les variables VITE_* pour le frontend et les clés API selon vos besoins

# Lancer en développement
netlify dev
```

### Build de production
```bash
npm run build
```

### Déploiement
Le projet est déployé automatiquement via Netlify (build + fonctions serverless).

## 📅 Changelog récent

### 2025-11-16

#### Général
- Mise à jour de la structure du projet et du README pour refléter les derniers réaménagements de dossiers et fichiers.
- Ajout de la fonction Netlify `consolidate-wiki.js` pour la consolidation/résumé automatique du wiki.
- Amélioration de la gestion et de la documentation des variables d'environnement (`.env.example` enrichi).
- Harmonisation des noms de composants et clarification de la structure des dossiers dans `src/`.
- Ajout de scripts utilitaires pour le développement et la contribution (`npm run lint`, `npm run format`).
- Mise à jour des dépendances npm (patchs de sécurité et compatibilité).
- Nettoyage de fichiers obsolètes dans `public/` et `src/`.

#### Wiki / Markdown
- Correction de bugs sur la navigation précédent/suivant dans le wiki.
- Amélioration de la robustesse de la linkification automatique des WikiWords (lib `linkifyWardWiki.js`).
- Correction de l'affichage et de la génération des résumés de pages wiki lors de l'archivage.
- Meilleure prise en compte des pages nouvellement créées ou modifiées dans la consolidation du document wiki.

#### Bob (Assistant IA)
- Amélioration de la gestion des prompts système, injection plus fiable du résumé consolidé du wiki.
- Sélection dynamique du provider IA selon la disponibilité des clés API (OpenAI, Hugging Face, Mistral, Anthropic, EdenAI).
- Gestion plus fine des erreurs côté UI lors des échanges avec Bob.
- Correction de l'affichage du chronomètre sur le bouton d'envoi.

#### Kudocratie
- Amélioration de la gestion et de la suggestion des tags lors de la création de propositions.
- Synchronisation plus robuste avec la table pivot Supabase pour les tags.
- Correction de l'affichage des statuts de propositions dans le tableau de bord.

## Audit en cours — ODJ ↔ Actes (Commune de Corte)

Un audit automatique compare les convocations / ordres du jour (ODJ) aux actes publiés (PV / délibérations) afin d'identifier :
- correspondances, modifications d'ordre, libellés divergents, périmètres modifiés, absences et ajouts.


### Sorties générées

- rapports : rapport-odj-acts-ai.md, rapport-odj-acts-ai.csv, rapport-odj-acts-ai.json (créés à la racine après exécution)
- archives officielles : les PDFs téléchargés sont sauvegardés dans public/docs/officiel/
  - Nommage : mairie-corte_<type>_<date>_<original>.pdf
  - <type> vaut convocation-odj / proces-verbal / deliberations selon le document
  - Exemple : public/docs/officiel/mairie-corte_convocation-odj_2025-10-28_modules-downloads-1910.pdf



### 2025-11-05

#### Wiki
- Génération automatique de résumés pour chaque page wiki lors de l'archivage.
- Création d'un document wiki consolidé à partir des titres, slugs et résumés de toutes les pages wiki.
- Sauvegarde du document wiki consolidé sur GitHub et dans une nouvelle table `consolidated_wiki_documents` de Supabase.
- Intégration du document wiki consolidé dans le prompt système du chatbot pour améliorer sa "mémoire" et sa pertinence.

### 2025-11-03

#### Général
- Correction du bug : Les majuscules sont désormais conservées lors de la création de pages Wiki (harmonisation des fonctions `normalizeSlug`).
- Amélioration UI : Ajout d'un chronomètre en temps réel sur le bouton d'envoi de Bob, affichant le temps écoulé pendant la génération de la réponse.
- Ajout de la page `Contact` (`/contact`) avec email configurable via `VITE_CONTACT_EMAIL` (valeur par défaut `jeanhuguesrobert@gmail.com`).
- Intégration d’un `ErrorBoundary` autour de `App` pour une gestion d’erreurs de rendu plus robuste.
- Unification/déduplication du Footer et harmonisation des liens légaux.
- Préparation du packaging Survey (structure et scripts).

#### Wiki / Markdown
- Linkification automatique des WikiWords CamelCase via `linkifyWardWiki` dans les rendus Markdown des pages suivantes :
  - `src/pages/Proposition.jsx` (description des propositions)
  - `src/components/LegalLinks.jsx` (pages légales)
  - `src/components/AuditContent.jsx` (audit éthique)
  - Déjà en place dans `Wiki.jsx`, `WikiPage.jsx` et `components/bob/ChatWindow.jsx`.
  - Comportement : CamelCase → `/wiki/<CamelCase>` ; opt-out `!WikiWord` ; exclusion automatique dans les blocs de code.
- Bouton de partage ajouté dans le Wiki (Web Share + copie presse-papier).
- Compatibilité étendue avec GitHub-Flavored Markdown (GFM).

#### Bob (Assistant IA)

- Support natif OpenAI si `OPENAI_API_KEY` est défini, sinon fallback Hugging Face.
- Support d’Anthropic via provider compatible (selon configuration).
- Routage « léger » puis bascule vers un modèle « lourd » si la première réponse n’est pas satisfaisante.
- Réponses Markdown sécurisées et compatibles GFM côté UI (`marked` + `DOMPurify`).
- Journaux renforcés côté fonctions : trace du provider et du modèle sélectionnés.
- Debug de la création de propositions (statut par défaut `active`, gestion des tags).

### 2025-11-01 → 2025-11-02

#### Wiki
- Amélioration du flux de création depuis une page inexistante : le bouton propose désormais de créer la page demandée avec adresse pré-remplie (`/wiki/new/:slug`) et sauvegarde via `?slug=` en cas de perte du paramètre de route.
- Écran de création : le titre n’est plus déduit automatiquement de l’adresse pour éviter la confusion. L’adresse est pré-remplie et verrouillée par défaut, avec option pour la modifier.
- Routes: ajout explicite de `/wiki/new/:slug` et durcissement de la navigation pour les pages inexistantes.

#### Consultation (Questionnaire)
- Passage à une terminologie agnostique à la communauté (municipalité, association, école, entreprise, communauté en ligne).
- Introduction d’un système modulaire de questionnaire (`src/config/questionnaireModules.js`) permettant d’adapter les questions par type de communauté et de générer l’état initial du formulaire dynamiquement.
- Mise à jour des en-têtes : « Démocratie locale à {CITY_NAME} » devient « Démocratie {getCommunityLabels().name} ».


#### Général
- Version générique adaptable à d’autres communes/mouvements.
- Améliorations cosmétiques (menu hamburger) et redirections vers l’accueil pour certains cas fréquents.
- Login unifié entre Bob et Kudocracy.
- Utilisation optimisée des modèles OpenAI si une clé API est disponible.
- Ajouts de liens légaux et affinement du prompt système de Bob.

### Wiki
- ✅ Routes dédiées création/édition (`/wiki/new`, `/wiki/:slug/edit`)
- ✅ Navigation précédent/suivant entre pages
- ✅ Boutons Partager et Modifier
- ✅ Contrôle d'unicité de l'adresse (slug)
- ✅ Pré-remplissage automatique en mode édition
- ✅ Hiérarchie typographique H1-H6 rétablie
- ✅ Styles Markdown améliorés (listes, citations, code)
- ✅ Renommage "slug" → "adresse de la page" dans l'UI
- ✅ Bouton "Archiver" → [dépot github "pertidellu"](https://github.com/JeanHuguesRobert/pertidellu/tree/main/wiki)

### Général
- ✅ Correction affichage version/date de déploiement
- ✅ Amélioration des messages d'erreur

### Kudocratie
- ✅ Ajout de la page détail des propositions `src/pages/Proposition.jsx`
- ✅ Routes dédiées : `/propositions/:id` (+ alias `/proposition/:id`)
- ✅ Description rendue en Markdown via `react-markdown` + `remark-gfm`
- ✅ Conversion automatique des liens wiki Markdown vers routes internes (`[label](wiki/adresse)` → `/wiki/:slug`)
- ✅ Propositions créées via Bob désormais en statut `active` par défaut

### Audit éthique
- ✅ Intégration du composant `AuditContent` avec rendu Markdown dynamique (`react-markdown` + `remark-gfm`)
- ✅ Fichier `audit-ethique.md` servi depuis `public/docs/` et accessible via la page `/audit`
- ✅ Correction de la navigation vers `/audit` (remplacement des balises `<a>` par `Link` React Router)
- ✅ Encapsulation du contenu Markdown dans `div.markdown-content` pour une application fiable des styles

### Consultation
- ✅ Ajout d’une case à cocher « Je veux participer à l’étude IA pour tous » après la question de consentement
- ✅ Icône d’information ouvrant une publication externe (nouvel onglet)
- ✅ Prise en charge de la nouvelle colonne Google Sheet « IA pour tous » pour les réponses
- ✅ Ajout d’une question « Les horaires actuels des conseils municipaux vous paraissent-ils pratiques ? » avec les options Oui, Non, Je ne sais pas, Je préfère ne pas répondre.
- ✅ Affichage des résultats sous forme de graphique circulaire dans la section des résultats.
- ✅ Mise à jour de la feuille Google Sheet pour inclure une colonne `Horaire Conseil Municipal`.

### Sécurité (CSP)
- ✅ Mise à jour de `netlify.toml` (directive `default-src`) : ajout de `fonts.googleapis.com`, `fonts.gstatic.com`, `*.w3.org` et `data:` pour corriger les blocages de polices et SVG

### Transparence (Enquête nationale)
- ✅ Documentation ajoutée et alignement avec l’initiative « Transparence »
- ✅ Résultats agrégés et partageables depuis la page des résultats et Google Sheets
- ✅ Respect des principes d’auditabilité, lisibilité et interopérabilité des données

## 🧭 Enquête nationale « Transparence »

Cette plateforme participe à l’initiative citoyenne « Transparence » visant à rendre les consultations locales lisibles, auditables et interopérables à l’échelle nationale.

- Objectifs
  - Rendre les résultats compréhensibles par tous, vérifiables et réutilisables
  - Favoriser la comparaison entre territoires et thématiques
  - Encourager la participation citoyenne et la publication responsable des données

- Intégration dans ce projet
  - Les réponses sont anonymisées et agrégées pour les visualisations
  - Les résultats sont accessibles depuis la page `Résultats` de l’application
  - Les exports (CSV/Sheets) facilitent le partage et la réutilisation

- Données et confidentialité
  - Respect du RGPD : aucune donnée sensible collectée
  - L’email est facultatif et uniquement si l’utilisateur souhaite être recontacté
  - La case « IA pour tous » permet de signaler une participation volontaire à une étude connexe

- Participer et contribuer
  - Remplir le formulaire de consultation
  - Partager la consultation via le bouton `Partager` pour élargir la participation
  - Proposer des améliorations via issues/PR (voir section Contribution)

- Références
  - Contact : `contact@lepp.fr`
  - Documentation complémentaire à ajouter par les mainteneurs (lien officiel « Transparence »)

## 📜 Historique du projet

### Phase 1 : Consultation citoyenne
- **v0.1.0** : Formulaire de consultation sur la démocratie locale
- **v0.2.0** : Intégration Google Sheets pour stockage des réponses
- **v0.3.0** : Graphiques interactifs (Recharts) pour visualisation des résultats
- **v0.4.0** : Page Méthodologie et Audit éthique

### Phase 2 : Kudocratie
- **v0.5.0** : Système de propositions citoyennes
- **v0.6.0** : Vote et délégation de vote
- **v0.7.0** : Tableau de bord avec statistiques en temps réel
- **v0.8.0** : Migration vers Supabase (PostgreSQL)

### Phase 3 : Wiki collaboratif
- **v0.9.0** : Base du wiki avec affichage Markdown
- **v0.9.5** : Édition inline et création de pages
- **v1.0.0** : Lancement officiel avec wiki fonctionnel

### Phase 4 : Améliorations UX
- **v1.0.1** : Refonte navigation wiki (routes dédiées)
- **v1.0.2** : Boutons Partager et navigation prev/next
- **v1.0.3** : Amélioration styles Markdown (H1-H6, listes, code)
- **v1.0.4** : Renommage "slug" → "adresse", corrections finales
- **v1.1.0** : Lancement de l’enquête Transparence et intégration du programme “IA pour tous”

### Phase 5 : IA conversationnelle
- **v1.2.5** : Ajout d'un résumé du wiki dans le prompt de Bob
- **v1.2.0** : Assistant IA « Bob » amélioré (streaming, fallback provider)
- Création de propositions et tags directement depuis le chat (statut par défaut `active`)
- Rendu des réponses en Markdown sécurisé (`marked` + `DOMPurify`), prompt système configurable (`public/prompts/bob-system.md` ou variables d’environnement)
- Fonction serverless `netlify/functions/rag_chatbot.js` avec modération et routage léger/lourd
- Prise en charge des liens wiki dans le Markdown (`[label](wiki/adresse)` → `/wiki/:slug`)
- Intégration aux routes de détail `/propositions/:id` lors de la création depuis le chat
- Journaux et gestion d’erreurs renforcés côté fonctions et UI

### Roadmap future
- 🔄 Système de notifications pour nouveaux contenus
- 🔄 Recherche full-text dans le wiki
- 🔄 Modération collaborative (signalement de pages)
- 🔄 Export PDF des résultats de consultation
- 🔄 Intégration cartographique pour les propositions locales
- 🔄 Tableau de bord Transparence

# Survey / Pertitellu — Plateforme citoyenne Corte

## 1. Prérequis

- Node.js 18+
- Netlify CLI (déploiement local des fonctions serverless)
- Supabase CLI (facultatif, pour appliquer les migrations)

## 2. Installation

```bash
npm install
```

## 3. Lancement

```bash

netlify dev          # Fonctions serverless (rag_chatbot)
```

## 4. Prompt système de Bob
- Le prompt par défaut est stocké dans `public/prompts/bob-system.md`.
- Le prompt fallback côté fonction utilise les variables d’environnement génériques (`CITY_NAME`, `MOVEMENT_NAME`, `PARTY_NAME`, `HASHTAG`, `BOT_NAME`) si aucun fichier ou texte n’est fourni.
- **Nouveau** : Les variables d'environnement frontend `VITE_BOT_NAME`, `VITE_CITY_NAME`, etc., sont utilisées côté UI pour l'affichage dynamique.
- **Résumé du wiki** : Un document consolidé du wiki est injecté dans le prompt pour améliorer la mémoire de l'IA.

## ⚙️ Configuration générique (toutes communes)
- Personnalisez la plateforme pour votre commune et mouvement/liste via `.env` (variables `VITE_*` pour le frontend, sans préfixe pour le backend).
- Frontend (Vite) :
  - `VITE_CITY_NAME` (ex. `Corte`), `VITE_CITY_TAGLINE` (ex. `CAPITALE`)
  - `VITE_MOVEMENT_NAME` (ex. `Pertitellu`), `VITE_PARTY_NAME` (ex. `Petit Parti`)
  - `VITE_HASHTAG` (ex. `#PERTITELLU`), `VITE_BOT_NAME` (ex. `Ophélia`)
  - `VITE_CONTACT_EMAIL` (email de contact affiché dans l'app)
- Backend (Netlify functions) :
  - `CITY_NAME`, `MOVEMENT_NAME`, `PARTY_NAME`, `HASHTAG`, `BOT_NAME`
- Effets UI principaux :
  - Page Transparence affiche le score par défaut pour `CITY_NAME` et utilise `HASHTAG` dans l’en-tête
  - Navigation et libellés dynamiques s’appuient sur les constantes du frontend
- Les réponses sont renvoyées en Markdown et sécurisées côté UI (`marked` + `DOMPurify`).
- Lors de la création de propositions depuis le chat, le statut par défaut est `active` afin qu’elles apparaissent dans la liste Kudocratie.

## 5. Configuration Hugging Face & Netlify

| Variable                   | Description                                          |
|----------------------------|------------------------------------------------------|
| `HUGGINGFACE_API_KEY`      | Jeton Hugging Face Inference API                     |
| `HUGGINGFACE_CHAT_PROVIDER`| Provider par défaut (ex. `hf-inference`, `together`) |
| `HUGGINGFACE_CHAT_MODEL`   | Modèle par défaut (ex. `meta-llama/Meta-Llama-3-8B-Instruct`) |


## 5bis. Configuration OpenAI

| Variable                   | Description                                        |
|----------------------------|----------------------------------------------------|
| `OPENAI_API_KEY`           | Clé API OpenAI pour activer le provider natif      |
| `OPENAI_BASE_URL`          | (Optionnel) Base URL API (par défaut `api.openai.com`) |
| `OPENAI_SMALL_MODEL`       | Modèle léger pour le routage (ex. `gpt-4o-mini`)   |
| `OPENAI_HEAVY_MODEL`       | Modèle lourd pour les réponses (ex. `gpt-4o`)      |
| `OPENAI_MODERATION_MODEL`  | Modèle de modération (ex. `omni-moderation-latest`) |

Notes
- Si `OPENAI_API_KEY` est défini, OpenAI est utilisé en priorité pour Bob, sinon Hugging Face.
- Les suggestions de tags côté UI nécessitent la clé Hugging Face côté frontend (`VITE_HUGGINGFACE_API_KEY`).

## 6. Supabase — tags des propositions

1. Vérifiez la présence de la colonne `tags` (table `propositions`).
   ```sql
   ALTER TABLE public.propositions
     ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
   ```
2. Les nouveaux tags saisis dans l’UI :
   - créent une entrée dans `public.tags` si nécessaire ;
   - sont attachés via la table pivot `public.proposition_tags`.
3. Rappelez-vous de mettre à jour vos règles RLS pour autoriser ces opérations.

## 6bis. Supabase — propositions et statuts

- Colonne `status` attendue dans `public.propositions` avec valeurs usuelles: `active`, `draft`, `closed`.
- Affichage dans l’application:
  - Les listes (Kudocracy, tableau de bord) filtrent sur `status = 'active'`.
  - Les auteurs peuvent voir leurs propres propositions selon RLS, mais la liste publique reste sur `active`.
- Création via UI/Chat: par défaut `status = 'active'` (modération manuelle côté administrateur en BD).
- Les tags sont gérés dynamiquement et liés via une table pivot.

### Routes de détail
- `/propositions/:id` (principal) et `/proposition/:id` (alias) renvoient vers la page détail `Proposition.jsx`.

### Markdown de la description
- Rendu via `react-markdown` + `remark-gfm` (titres, listes, liens, tableaux, code).
- HTML brut désactivé pour sécurité (pas d’injection).
- Liens wiki au format Markdown sont réécrits vers des routes internes:
  - `[label](wiki/adresse)`
  - `[label](/wiki/adresse)`
  - `[label](wiki:adresse)`
  → mène à `/wiki/:slug` (navigation interne React Router).
- Les WikiWords CamelCase sont automatiquement convertis en liens internes (hors blocs de code, opt-out possible avec `!WikiWord`).

### Styles
- Les contenus Markdown utilisent la classe `markdown-content` (voir `src/index.css`).

## 7. Commandes utiles

```bash
netlify env:list
supabase db diff   # si vous utilisez Supabase CLI
```

## 8. Points de vigilance
- En local, `VITE_HUGGINGFACE_API_KEY` est optionnelle (désactive la recherche/suggestion de tags).
- `cdn.tailwindcss.com` est utilisé uniquement en développement ; configurez Tailwind via PostCSS pour la production.
- Les fonctions Netlify (`/.netlify/functions/rag_chatbot`) se lancent via `netlify dev`.
- **Nouveau** : Les variables d'environnement frontend (préfixe `VITE_`) sont strictement nécessaires pour la configuration dynamique de l'UI.
- Pour la consolidation du wiki et l'intégration dans le prompt IA, assurez-vous que les fonctions Netlify disposent des droits GitHub/Supabase nécessaires.

## 📄 Licence

MIT - Projet open-source pour la démocratie locale

## 🤝 Contact

Initiative #PERTITELLU - Corti Capitale  
📧 [jeanhuguesrobert@gmail.com](mailto:jeanhuguesrobert@gmail.com)

