---
document_role: operational
document_kind: documentation
visibility: public
lifecycle_state: active
classification_source: cogentia.js
classification_version: "1"
classification_rule: documentation
classification_confidence: medium
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
date: "2026-09-15"
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---

# Intégration MCP (Model Context Protocol) – Ophélia

## Qu’est-ce que MCP ?

Le Model Context Protocol (MCP) est un standard d’interopérabilité pour exposer des modèles, des
outils et des ressources contextuelles à des IDE, assistants IA, et applications LLM modernes
(Claude Desktop, Cursor, Continue, etc.).

## Objectifs pour Ophélia

- Permettre à Ophélia d’être accessible depuis des outils compatibles MCP (ex : Claude Desktop,
  Continue, Cursor…)
- Exposer :
  - Les ressources : wiki, documents, Q&A, etc.
  - Les outils : recherche wiki, recherche web, etc.
  - Les prompts spécialisés (audit, citoyen, etc.)
- Faciliter l’intégration dans des environnements de développement et d’assistance IA avancés

## Feuille de route MCP

1. **Étude du protocole MCP**
   - Lire la documentation officielle (https://modelcontext.org/)
   - Comprendre les endpoints, schémas, et flux d’authentification

2. **Prototype serveur MCP**
   - Créer un dossier `mcp/` ou dépôt séparé
   - Utiliser le SDK MCP officiel (Node.js ou Python)
   - Exposer les ressources d’Ophélia via MCP (ex : `/resources`, `/tools`, `/prompts`)
   - Mapper les outils existants (RAG, recherche, etc.)

3. **Interopérabilité**
   - Tester l’intégration avec Claude Desktop, Continue, Cursor
   - Documenter l’URI MCP pour l’intégration

4. **Documentation**
   - Rédiger un guide d’intégration MCP dans `docs/` (ce fichier)
   - Exemples d’utilisation avec des outils compatibles

5. **Publication et maintenance**
   - Publier l’URI MCP
   - Maintenir la compatibilité avec les évolutions du protocole

## Ressources utiles

- [Site officiel MCP](https://modelcontext.org/)
- [Exemple de serveur MCP (Node.js)](https://github.com/modelcontext/mcp-server)
- [Exemple d’intégration Continue](https://continue.dev/docs/mcp)

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
