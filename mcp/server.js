// mcp/server.js
// Prototype minimal de serveur MCP pour Ophélia

const express = require('express');
const cors = require('cors');
const { ask } = require('../packages/ophelia');

const app = express();
app.use(cors());
app.use(express.json());

// MCP: expose /resources, /tools, /prompts, /ask

app.get('/resources', (req, res) => {
  // Expose wiki, docs, Q&A (exemple statique)
  res.json([
    { id: 'wiki', type: 'wiki', label: 'Wiki municipal', url: '/public/docs/' },
    { id: 'qa', type: 'qa', label: 'Questions/Réponses', url: '/public/docs/qa_pairs.jsonl' }
  ]);
});

app.get('/tools', (req, res) => {
  // Expose search_wiki, web_search, etc. (exemple statique)
  res.json([
    { id: 'search_wiki', label: 'Recherche Wiki', description: 'Recherche dans le wiki municipal' },
    { id: 'web_search', label: 'Recherche Web', description: 'Recherche sur le web local' }
  ]);
});

app.get('/prompts', (req, res) => {
  // Expose prompts spécialisés (exemple statique)
  res.json([
    { id: 'audit', label: 'Audit', description: 'Prompt pour audit citoyen' },
    { id: 'citoyen', label: 'Citoyen', description: 'Prompt citoyen généraliste' }
  ]);
});

app.post('/ask', async (req, res) => {
  // Proxy vers le moteur Ophélia (API REST)
  try {
    const { question, ...options } = req.body;
    const result = await ask(question, options);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
});
