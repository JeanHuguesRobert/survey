# 📊 Consultation Citoyenne Pertitellu

Une plateforme de consultation citoyenne pour les élections municipales de Corte, incluant un wiki collaboratif et un système de propositions citoyennes (Kudocratie).

Disponible en version [Prototype](https://lucky-concha-a9fcd2.netlify.app/)

## 🚀 Fonctionnalités principales

### 1. Consultation citoyenne
- Questionnaire sur la démocratie locale à Corte
- Visualisation en temps réel des résultats (graphiques interactifs)
- Partage social et anonymisation des réponses

### 2. Wiki collaboratif
- **Navigation intuitive** : liste des pages, recherche par adresse
- **Édition/Création** : routes dédiées `/wiki/new` et `/wiki/:slug/edit`
- **Rendu Markdown** : support H1-H6, listes, citations, liens internes/externes, code
- **Navigation contextuelle** : boutons précédent/suivant entre les pages
- **Partage social** : API Web Share + copie dans le presse-papier

### 3. Kudocratie (Propositions citoyennes)
- Création et vote de propositions
- Délégation de vote sur des sujets spécifiques
- Tableau de bord des résultats

## 🛠️ Stack technique

- **Frontend** : React 18 + Vite
- **Routing** : React Router v6
- **Styles** : Tailwind CSS + CSS modules
- **Backend** : Supabase (PostgreSQL)
- **Graphiques** : Recharts
- **Markdown** : react-markdown + remark-gfm

## 📁 Structure du projet

```
src/
├── components/
│   ├── ErrorBoundary.jsx
│   └── kudocracy/
├── pages/
│   ├── Wiki.jsx           # Liste des pages wiki
│   ├── WikiPage.jsx       # Affichage d'une page
│   ├── WikiCreate.jsx     # Création de page
│   ├── WikiEdit.jsx       # Édition de page
│   ├── Kudocracy.jsx
│   ├── Methodologie.jsx
│   └── Audit.jsx
├── lib/
│   └── supabase.js
├── constants.js
└── index.css              # Styles Markdown
```

## 🗄️ Base de données (Supabase)

### Table `wiki_pages`
```sql
CREATE TABLE wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## 🚀 Installation et déploiement

### Prérequis
- Node.js ≥ 18
- npm ou yarn
- Compte Supabase

### Installation locale
```bash
# Cloner le projet
git clone <repo-url>
cd survey

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# Lancer en développement
npm run dev
```

### Build de production
```bash
npm run build
# Les fichiers sont générés dans dist/
```

### Déploiement
Le projet est déployé automatiquement via Vercel/Netlify (selon configuration).

## 📝 Workflow de contribution

1. **Créer une branche** : `git checkout -b feature/ma-fonctionnalite`
2. **Commiter** : `git commit -m "feat: ajouter X"`
3. **Pousser** : `git push origin feature/ma-fonctionnalite`
4. **Ouvrir une PR** sur GitHub

## 📅 Changelog récent (depuis le 2025-10-24)

### Wiki
- ✅ Routes dédiées création/édition (`/wiki/new`, `/wiki/:slug/edit`)
- ✅ Navigation précédent/suivant entre pages
- ✅ Boutons Partager et Modifier
- ✅ Contrôle d'unicité de l'adresse (slug)
- ✅ Pré-remplissage automatique en mode édition
- ✅ Hiérarchie typographique H1-H6 rétablie
- ✅ Styles Markdown améliorés (listes, citations, code)
- ✅ Renommage "slug" → "adresse de la page" dans l'UI
- ✅ Bouton "Archiver" → [dépot github "pertidellu"](https://github.com/JeanHuguesRobert/pertitellu/tree/main/wiki)

### Général
- ✅ Correction affichage version/date de déploiement
- ✅ Amélioration des messages d'erreur

### Audit éthique
- ✅ Intégration du composant `AuditContent` avec rendu Markdown dynamique (`react-markdown` + `remark-gfm`)
- ✅ Fichier `audit-ethique.md` servi depuis `public/docs/` et accessible via la page `/audit`
- ✅ Correction de la navigation vers `/audit` (remplacement des balises `<a>` par `Link` React Router)
- ✅ Encapsulation du contenu Markdown dans `div.markdown-content` pour une application fiable des styles

### Consultation
- ✅ Ajout d’une case à cocher « Je veux participer à l’étude IA pour tous » après la question de consentement
- ✅ Icône d’information ouvrant une publication externe (nouvel onglet)
- ✅ Prise en charge de la nouvelle colonne Google Sheet « IA pour tous » pour les réponses

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
  - Remplir le formulaire de consultation (#PERTITELLU – Corti Capitale)
  - Partager la consultation via le bouton `Partager` pour élargir la participation
  - Proposer des améliorations via issues/PR (voir section Contribution)

- Références
  - Contact : `contact@pertitellu.org`
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

### Roadmap future
- 🔄 Système de notifications pour nouveaux contenus
- 🔄 Recherche full-text dans le wiki
- 🔄 Modération collaborative (signalement de pages)
- 🔄 Export PDF des résultats de consultation
- 🔄 Intégration cartographique pour les propositions locales

## 📄 Licence

MIT - Projet open-source pour la démocratie locale

## 🤝 Contact

Initiative #PERTITELLU - Corti Capitale  
📧 [contact@pertitellu.org](mailto:contact@pertitellu.org)
