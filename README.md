# Consultation citoyenne Pertitellu

Application de consultation citoyenne pour Corte.

[Accessible ici](https://lucky-concha-a9fcd2.netlify.app/)

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
- v1.0.1
  - Ajout rapport d'audit éthique
  - Section profil optionnelle clarifiée
  - Affichage temps réel des résultats
  - Information inscription électorale
  - Ajout option "Je préfère ne pas répondre" sur les questions sensibles

### Planifiées

#### v1.0.2 - Fiabilisation
- Rotation aléatoire des questions
- Cookie de session anti-spam

#### v1.1.0 - Accessibilité
- Version papier du questionnaire
- Interface adaptée seniors/malvoyants
- Analyse par quartier
- QR codes dans la ville

#### v1.2.0 - Engagement
- Système de propositions citoyennes
- Votes sur les propositions
- Commentaires et débats
- Comité de suivi indépendant

#### v2.0.0 - Démocratie directe (2026)
- Plateforme permanente de consultation
- Budget participatif
- Pétitions citoyennes
- Référendums d'initiative locale
- API publique pour les données
- Applications mobiles natives

#### v3.0.0 - Gouvernance partagée (2027)
- Conseil citoyen numérique
- Blockchain pour la transparence
- Intégration avec les services municipaux
- Formation citoyenne en ligne
- Monitoring de l'impact des décisions

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
