# PERTITELLU - Consultation Citoyenne

Application web de consultation citoyenne pour le collectif Pertitellu à Corte.

Disponible [ici](https://68f5dca7ec6d8bc46a9fa85c--lucky-concha-a9fcd2.netlify.app/).

## Fonctionnalités

- Formulaire de consultation publique
- Visualisation des résultats en temps réel
- Intégration avec Google Sheets pour le stockage des données
- Interface responsive et accessible
- Graphiques interactifs pour les statistiques
- Partage facile sur les réseaux sociaux

## Technologies utilisées

- React
- Tailwind CSS
- Recharts pour les visualisations
- Google Apps Script pour le backend

## Installation

1. Clonez le dépôt :
```bash
git clone https://github.com/votrecompte/tweesic
cd tweesic/survey
```

2. Installez les dépendances :
```bash
npm install
```

3. Créez un fichier `.env` à la racine du projet :
```
REACT_APP_GOOGLE_SCRIPT_URL=votre_url_google_script
```

4. Lancez le serveur de développement :
```bash
npm start
```

## Configuration Google Sheets

1. Créez une nouvelle feuille Google Sheets
2. Dans l'éditeur de script (Tools > Script editor), créez un nouveau déploiement
3. Copiez l'URL du déploiement dans votre fichier `.env`

## Déploiement

```bash
npm run build
```

Les fichiers de production seront générés dans le dossier `build`.

## Contribution

Les contributions sont les bienvenues. Merci de créer une issue avant de soumettre une pull request.

## Licence

MIT
