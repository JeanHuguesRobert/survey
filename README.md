# Consultation citoyenne Pertitellu

Application de consultation citoyenne pour Corte.

## À propos

Initiative lancée dans le cadre des élections municipales de Corte pour :
- Recueillir l'avis des habitants sur des sujets clés
- Expérimenter des outils de démocratie participative
- Établir un diagnostic partagé de la situation de la ville

## Transparence

Cette application s'inscrit dans une démarche de transparence totale :
- Code source ouvert et public
- [Rapport d'audit éthique](/docs/audit-ethique.md) détaillé
- Résultats consultables en temps réel
- Méthodologie documentée

## Améliorations

### Déjà réalisées
- v1.0.1 (20/01/2024)
  - Ajout rapport d'audit éthique
  - Section profil optionnelle clarifiée
  - Affichage temps réel des résultats
  - Information inscription électorale

### Planifiées
- v1.0.2
  - Rotation aléatoire des questions
  - Cookie de session anti-spam
  - Export PDF des résultats

- v1.1.0
  - Version papier du questionnaire
  - Analyse par quartier
  - Comité de suivi indépendant

## Déploiement

L'application est déployée sur Netlify :
```bash
npm run build
# Les redirections sont gérées par netlify.toml
```

## Développement local
```bash
npm install
npm start
```

## Licence

MIT - Partagez, modifiez, réutilisez librement
