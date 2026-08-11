---
document_role: "operational"
document_kind: "documentation"
visibility: "public"
lifecycle_state: "active"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "documentation"
classification_confidence: "medium"
---

# Ophelia Template Engine (OTE)

L'**Ophelia Template Engine (OTE)** est un moteur de templating léger et ultra-performant, conçu
spécifiquement pour les Netlify Edge Functions. Il permet d'injecter dynamiquement des données de
configuration (Supabase, variables d'environnement) directement dans les fichiers HTML et CSS au
moment de la requête, garantissant une compatibilité totale avec les crawlers SEO.

## Syntaxe de base

Toutes les balises utilisent la syntaxe double accolades : `{{ ... }}`. Les espaces autour du
contenu des balises sont ignorés.

### Variables

Affiche la valeur d'une clé de configuration.

```html
<h1>{{ COMMUNITY_NAME }}</h1>
<p>{{ COMMUNITY_TAGLINE || "Valeur par défaut si vide" }}</p>
```

### Commentaires

Le contenu des balises de commentaire est totalement supprimé du fichier final.

```html
{{ ! Ce commentaire n'apparaîtra pas dans le code source du navigateur }}
```

## Directives de Structure

### Inclusions

Permet d'inclure un autre fichier (HTML, SVG, etc.). Le chemin est relatif à la racine du serveur.

```html
{{ #INCLUDE "/parts/header.html" }}
```

_Note: La profondeur maximale d'inclusion est de 3 niveaux pour éviter les boucles infinies._

### Blocs Conditionnels

Affiche le contenu seulement si la variable existe et n'est pas "fausse" (`false`, `0`, `""`).

**Si (IF) :**

```html
{{ #IF FACEBOOK_APP_ID }}
<meta property="fb:app_id" content="{{ FACEBOOK_APP_ID }}" />
{{ /IF }}
```

**Sauf si (IFNOT / UNLESS) :**

```html
{{ #IFNOT MAINTENANCE_MODE }}
<main>Contenu du site</main>
{{ /IFNOT }}
```

## Comparaisons Avancées

Les blocs de comparaison permettent de tester des valeurs spécifiques.

### Égalité & Différence

- `IFEQ` ou `IFIS` : Si égal
- `IFNEQ` ou `IFNOTIS` : Si différent

```html
{{ #IFEQ THEME "dark" }}
<body class="bg-black text-white">
  {{ /IFEQ }}
</body>
```

### Comparaisons Numériques

Fonctionne sur les valeurs pouvant être converties en nombres.

- `IFGT` : Plus grand que (Greater Than)
- `IFGE` : Plus grand ou égal (Greater or Equal)
- `IFLT` : Plus petit que (Less Than)
- `IFLE` : Plus petit ou égal (Less or Equal)

```html
{{ #IFGT USER_COUNT 100 }}
<span>Plus de 100 utilisateurs actifs !</span>
{{ /IFGT }}
```

### Contenu (Strings)

- `IFCONTAINS` ou `IFIN` : Si la valeur contient une sous-chaîne.

```html
{{ #IFCONTAINS APP_URL "dev." }}
<div class="banner">Version de développement</div>
{{ /IFCONTAINS }}
```

## Filtres

Les filtres permettent de transformer la valeur avant l'affichage. Ils peuvent être chaînés avec le
caractère pipe `|`.

| Filtre         | Description                     | Exemple        |
| :------------- | :------------------------------ | :------------- | ------------------------- |
| `uppercase`    | Convertit en majuscules         | `{{ NAME       | uppercase }}`             |
| `lowercase`    | Convertit en minuscules         | `{{ NAME       | lowercase }}`             |
| `trim`         | Supprime les espaces inutiles   | `{{ NAME       | trim }}`                  |
| `json`         | Convertit en chaîne JSON valide | `{{ CONFIG     | json }}`                  |
| `urlencode`    | Encode pour une URL             | `{{ TITLE      | urlencode }}`             |
| `truncate(n)`  | Tronque à `n` caractères        | `{{ DESC       | truncate(50) }}`          |
| `date(fmt)`    | Formate une date (YYYY, MM, DD) | `{{ UPDATED_AT | date(YYYY) }}`            |
| `escape`       | Échappe les caractères HTML     | `{{ USER_INPUT | escape }}`                |
| `strip_html`   | Supprime les balises HTML       | `{{ CONTENT    | strip_html }}`            |
| `replace(a,b)` | Remplace `a` par `b`            | `{{ TEXT       | replace("old", "new") }}` |

**Exemple de chaînage :**

```html
<title>{{ COMMUNITY_NAME | trim | uppercase }}</title>
<meta name="description" content="{{ DESCRIPTION | strip_html | truncate(160) }}" />
```

## Système de Plugins

OTE est extensible. Pour ajouter un nouveau filtre, il suffit d'ajouter une fonction dans le fichier
`src/netlify/edge-functions/lib/ote-filters.js`.

Chaque fonction prend la valeur en premier argument, puis les arguments passés dans le template :

```javascript
// Exemple d'ajout dans ote-filters.js
export const filters = {
  // ...
  prefix: (val, prefix) => prefix + String(val),
};
```

Utilisation : `{{ NAME | prefix("M. ") }}`

---

_Documentation générée le 2025-12-22_
