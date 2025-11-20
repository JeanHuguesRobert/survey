# 📊 Survey - Plateforme de Consultation Citoyenne

> Prototype disponible sur [LePP.fr](http://lepp.fr/)

**Survey** (aussi appelé **Pertitellu** en corse) est une plateforme numérique conçue pour renforcer la démocratie participative locale. Elle permet aux citoyens de donner leur avis, de proposer des idées et de participer activement à la vie de leur commune ou communauté.

---

## 🎯 À quoi ça sert ?

Cette application offre **six outils principaux** pour la participation citoyenne :

### 1. ☕ **Café Pertitellu** - L'espace social citoyen

Un espace de discussion et d'échange convivial où vous pouvez :
- **Créer et rejoindre des groupes** thématiques (urbanisme, culture, environnement, etc.)
- **Participer à des forums** de quartier pour s'organiser localement
- **Partager des blogs citoyens** sur la vie locale
- **Réagir et commenter** les publications pour enrichir les débats
- **Créer votre profil** avec votre quartier et vos centres d'intérêt
- **Rejoindre des associations** et mobiliser autour de projets
- **S'abonner aux contenus** qui vous intéressent pour suivre les discussions

**Fonctionnalités :**
- Types de groupes : Forums, Blogs, Quartiers, Associations
- Types de publications : Discussions, Annonces, Événements, Questions/Réponses
- Système de réactions (👍 ❤️ 😂 🤔 😮 😢)
- **Abonnements universels** : suivez n'importe quel contenu commentable (posts, propositions, pages wiki)
- **Fil d'abonnements** : recevez les nouveaux commentaires sur vos contenus suivis
- Modération citoyenne respectueuse
- Authentification sécurisée avec gestion de profil complète

### 2. 💬 **Ophélia** - L'assistante IA conversationnelle

Une intelligence artificielle qui répond à vos questions en français et vous aide à :
- Mieux comprendre les enjeux locaux
- Créer des propositions citoyennes
- Enrichir le wiki collaboratif
- Accéder rapidement aux informations de la plateforme

**Nouveautés récentes :**
- Interface modernisée avec un design élégant et épuré
- Ophélia connaît maintenant tout le contenu du wiki grâce à une consolidation automatique
- Support de plusieurs fournisseurs d'IA (OpenAI, Hugging Face, Anthropic, etc.)
- Mode streaming pour des réponses en temps réel

### 3. 📖 **Wiki Collaboratif** - La mémoire partagée

Un espace où chacun peut documenter, partager et accéder aux connaissances :
- Création et édition de pages en langage Markdown (simple et accessible)
- Recherche rapide par titre ou adresse
- Navigation intuitive entre les pages
- Partage facile sur les réseaux sociaux
- Génération automatique de résumés

**Nouveautés récentes :**
- **Navigation moderne** avec tri (A-Z, Z-A, date de création, dernière modification)
- **Recherche en temps réel** pour trouver rapidement une page
- **Deux modes d'affichage** : grille ou liste
- **Statistiques** : nombre total de pages, dernière mise à jour
- **Barre latérale** redimensionnable pour améliorer l'ergonomie
- Affichage des métadonnées (auteur, dates de création et modification)

### 4. 🗳️ **Kudocratie** - Propositions et délégation de vote

Un système de démocratie liquide où vous pouvez :
- Proposer des idées et projets pour votre commune
- Voter directement sur les propositions qui vous intéressent
- Déléguer votre vote à des personnes de confiance sur certains sujets
- Suivre l'évolution des propositions en temps réel
- Organiser les propositions par thèmes (tags)

### 5. 📊 **Consultations** - Sondages et enquêtes

Des questionnaires sur des enjeux de démocratie locale :
- Questions adaptables à différents types de communautés (municipalité, association, école, etc.)
- Résultats visualisés en temps réel avec des graphiques interactifs
- Anonymat garanti et respect du RGPD
- Participation à l'enquête nationale "Transparence"

### 6. 📊 **Transparence** - Audit démocratique

Un outil d'évaluation et de suivi de la transparence des institutions locales :
- Critères de transparence adaptés au type de communauté
- Suivi des bonnes pratiques démocratiques
- Comparaison entre territoires
- Base de données publique des communes transparentes

---

## ✨ Fonctionnalités supplémentaires

- **Audit de transparence** : pour évaluer le respect du public lors des conseils municipaux
- **Liens vers des services externes** : signalement d'incidents urbains, agenda social, entraide bénévole
- **Configuration adaptable** : la plateforme peut être personnalisée pour n'importe quelle commune ou mouvement citoyen

---

## 🚀 Comment l'utiliser ?

### Pour les citoyens (utilisateurs)

1. **Visitez le site** : [lepp.fr](http://lepp.fr/)
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

# 4. Lancer en mode développement
netlify dev
```

L'application sera accessible sur `http://localhost:8888`

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

## 📅 Dernières améliorations (Novembre 2025)

### Système d'abonnements universel (NOUVEAU)
- ✨ **Abonnez-vous à n'importe quel contenu** : posts, propositions, pages wiki
- ✨ **Fil d'abonnements personnalisé** avec filtres par type de contenu
- ✨ **Notifications en temps réel** des nouveaux commentaires sur vos contenus suivis
- ✨ **Compteur d'abonnés** visible sur chaque contenu
- ✨ **Auto-abonnement** lors de la création de contenu
- ✨ **Statistiques d'abonnements** dans le tableau de bord utilisateur
- 🔧 Intégration dans PostView, Proposition et bientôt les pages Wiki

### Café Pertitellu
- ✨ **Espace social complet** : forums, blogs, quartiers, associations
- ✨ **Système de groupes** avec types personnalisables
- ✨ **Publications diverses** : discussions, annonces, événements, Q&A
- ✨ **Réactions et commentaires** pour enrichir les échanges
- ✨ **Profils utilisateurs** avec nom d'affichage, quartier et centres d'intérêt
- ✨ **Authentification sécurisée** avec création automatique de profil
- 🔧 Intégration complète avec le système d'authentification Supabase

### Gestion des profils utilisateurs
- ✨ **Page de profil dédiée** pour gérer ses informations personnelles
- ✨ **Hook personnalisé** `useUserProfile` pour accéder aux données de profil
- ✨ **Trigger automatique** pour créer un profil lors de l'inscription
- ✨ **Composant UserDisplay** pour afficher les noms d'utilisateurs de manière cohérente
- ✨ **Affichage du profil** dans le footer et le menu avec lien vers la page de profil

### Wiki
- ✨ **Navigation moderne** : tri par titre ou date, recherche instantanée
- ✨ Interface à deux panneaux avec barre latérale redimensionnable
- ✨ Affichage des informations d'auteur et dates
- ✨ Modes de visualisation grille/liste
- 🔧 Correction de bugs sur la navigation entre pages
- 🔧 Amélioration de la génération automatique de résumés

### Ophélia (Assistant IA)
- ✨ Look moderne et épuré inspiré des meilleures interfaces conversationnelles
- ✨ Accès à toute la connaissance du wiki grâce à la consolidation automatique
- 🔧 Gestion améliorée des différents fournisseurs d'IA
- 🔧 Mode streaming pour des réponses fluides en temps réel
- 🔧 Meilleure gestion des erreurs

### Kudocratie
- 🔧 Amélioration du système de tags
- 🔧 Synchronisation plus fiable avec la base de données

### Général
- 📱 Optimisations pour une meilleure utilisation sur mobile
- 🎨 Modernisation de l'interface globale
- 🔒 Renforcement de la sécurité et du respect du RGPD

---

## 🗂️ Structure du projet

```
survey/
├── netlify/
│   └── functions/          # Fonctions serverless (IA, consolidation wiki, etc.)
├── public/
│   ├── prompts/            # Configuration de l'assistant IA
│   └── docs/               # Documents publics (audit éthique, annonces, etc.)
├── src/
│   ├── components/
│   │   ├── bob/           # Interface de l'assistant Ophélia
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

La plateforme est **générique et adaptable** à n'importe quelle commune ou communauté. Vous pouvez personnaliser :

- Le nom de votre commune (ex: `Corte`)
- Le nom de votre mouvement (ex: `Pertitellu`)
- Le nom de l'assistant IA (ex: `Ophélia`)
- Les couleurs et le logo
- Les questions des consultations

Toute la configuration se fait via le fichier `.env`. Consultez `.env.example` pour les détails.

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
- 🔄 **Messagerie privée** entre utilisateurs
- 🔄 **Système de badges** pour récompenser l'engagement citoyen
- 🔄 Recherche avancée dans le wiki
- 🔄 Export PDF des résultats
- 🔄 Carte interactive des propositions locales
- 🔄 Tableau de bord "Transparence" national
- 🔄 **Intégration calendrier** pour les événements du Café

---

## 📜 Licence

**MIT** - Projet open-source pour la démocratie locale

---

## 🤝 Contact et contribution

**Initiative #PERTITELLU - Corti Capitale**

📧 Email : [jeanhuguesrobert@gmail.com](mailto:jeanhuguesrobert@gmail.com)  
🌐 Site : [lepp.fr](http://lepp.fr/)

**Vous souhaitez contribuer ?**
- Testez la plateforme et signalez les bugs
- Proposez des améliorations via GitHub Issues
- Partagez la plateforme dans votre commune
- Contactez-nous pour adapter Survey à votre territoire

---

## 📖 Annexes techniques

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
- `group_roles` : rôles dans les groupes (owner, moderator, member)
- `read_tracking` : suivi de lecture des posts
- `activity_log` : journal d'activité
- `wiki_pages` : pages du wiki
- `propositions` : propositions citoyennes
- `tags` : étiquettes pour les propositions
- `votes` : votes des utilisateurs
- `delegations` : délégations de vote
- `municipal_transparency` : données de transparence des communes

### Métadonnées JSONB
Toutes les tables principales utilisent une colonne `metadata` au format JSONB avec `schemaVersion` pour faciliter les évolutions futures :

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
