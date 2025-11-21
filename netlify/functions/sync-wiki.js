import { createClient } from '@supabase/supabase-js';
import OpenAI from "openai";
import { GITHUB_CONFIG } from '../functions/constants.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

async function generatePageSummary(pageContent, pageTitle) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY manquant pour la génération de résumé.");
    return null;
  }

  const client = new OpenAI({ apiKey });

  const systemPrompt = `Tu es un assistant expert en résumé. Ton rôle est de créer un résumé informatif d'une page wiki. Le résumé doit capturer les points clés et l'essence du contenu, être autonome et adapté à un agent conversationnel.`;
  const userQuestion = `Résume la page wiki suivante intitulée "${pageTitle}":\n\n${pageContent}`; 

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 500, // Suffisant pour un résumé de 200 mots
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuestion },
      ],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Erreur lors de la génération du résumé avec OpenAI:", error);
    return null;
  }
}

// ============================================================================
// CONSOLIDATED WIKI DOCUMENT GENERATION
// ============================================================================

async function generateConsolidatedWikiDocument() {
  const { data: pages, error } = await supabase
    .from('wiki_pages')
    .select('title, slug, summary');

  if (error) {
    console.error("Erreur lors de la récupération des pages wiki:", error);
    return null;
  }

  let consolidatedContent = "# Résumé consolidé du Wiki\n\n";

  if (pages && pages.length > 0) {
    for (const page of pages) {
      consolidatedContent += `## [${page.title}](/wiki/${page.slug})\n\n`;
      if (page.summary) {
        consolidatedContent += `${page.summary}\n\n`;
      } else {
        consolidatedContent += `(Pas de résumé disponible pour cette page.)\n\n`;
      }
      consolidatedContent += `---\n\n`;
    }
  } else {
    consolidatedContent += "Aucune page wiki disponible pour le moment.\n\n";
  }

  return consolidatedContent;
}

export default async (req, context) => {
  // Vérifier la méthode
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { pageId, slug } = await req.json();

    if (!pageId && !slug) {
      return new Response(JSON.stringify({ error: 'pageId or slug required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Récupérer la page depuis Supabase
    let query = supabase.from('wiki_pages').select('*');
    
    if (pageId) {
      query = query.eq('id', pageId);
    } else {
      query = query.eq('slug', slug);
    }
    
    const { data: page, error: pageError } = await query.single();

    if (pageError || !page) {
      return new Response(JSON.stringify({ error: 'Page not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Vérifier si déjà synced aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const { data: lastSync } = await supabase
      .from('git_sync_log')
      .select('*')
      .eq('page_id', page.id)
      .eq('last_sync_date', today)
      .single();

    if (lastSync) {
      return new Response(JSON.stringify({ 
        message: 'Already synced today',
        commit_sha: lastSync.commit_sha 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Préparer le contenu Markdown avec frontmatter
    const frontmatter = `---
title: ${page.title}
slug: ${page.slug}
author_id: ${page.author_id || 'unknown'}
created_at: ${page.created_at}
updated_at: ${page.updated_at}
---

`;
    const content = frontmatter + page.content;

    // 4. Commit sur GitHub
    const filePath = `${GITHUB_CONFIG.wikiPath}/${page.slug}.md`;
    const commitSha = await commitToGitHub(filePath, content, page.title);

    // 4.1. Générer et sauvegarder le résumé de la page
    const summary = await generatePageSummary(page.content, page.title);
    if (summary) {
      const { error: updateError } = await supabase
        .from('wiki_pages')
        .update({ summary: summary })
        .eq('id', page.id);

      if (updateError) {
        console.error("Erreur lors de la sauvegarde du résumé dans Supabase:", updateError);
      } else {
        console.log(`Résumé généré et sauvegardé pour la page ${page.title}`);
      }
    }

    // Générer le document wiki consolidé
    const consolidatedDocument = await generateConsolidatedWikiDocument();
    if (consolidatedDocument) {
      // Sauvegarder le document consolidé sur GitHub
      const consolidatedFileName = "consolidated_wiki_document.md";
      const commitMessage = "Mise à jour du document wiki consolidé";
      await commitToGitHub(consolidatedFileName, consolidatedDocument, commitMessage);
      console.log("Document wiki consolidé sauvegardé sur GitHub.");

      // Sauvegarder le document consolidé dans Supabase
      const { error: consolidatedDocError } = await supabase
        .from('consolidated_wiki_documents') // Assuming this table exists as per instruction
        .insert({ content: consolidatedDocument, updated_at: new Date().toISOString() });

      if (consolidatedDocError) {
        console.error("Erreur lors de la sauvegarde du document consolidé dans Supabase:", consolidatedDocError);
      } else {
        console.log("Document wiki consolidé sauvegardé dans Supabase.");
      }
    }

    // 5. Logger le sync
    await supabase.from('git_sync_log').insert({
      page_id: page.id,
      last_sync_date: today,
      commit_sha: commitSha
    });

    return new Response(JSON.stringify({ 
      success: true,
      commit_sha: commitSha,
      file_path: filePath
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function commitToGitHub(path, content, title) {
  const { owner, repo, branch, token } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // 1. Vérifier si le fichier existe déjà
  let sha = null;
  try {
    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    }
  } catch (e) {
    // Fichier n'existe pas, c'est OK
  }

  // 2. Créer ou mettre à jour le fichier
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64');
  const commitMessage = sha 
    ? `Update: ${title} - ${new Date().toISOString().split('T')[0]}`
    : `Create: ${title} - ${new Date().toISOString().split('T')[0]}`;

  const body = {
    message: commitMessage,
    content: contentBase64,
    branch: branch
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${error}`);
  }

  const result = await response.json();
  return result.commit.sha;
}
