import { createClient } from '@supabase/supabase-js';
import { GITHUB_CONFIG, SUPABASE_CONFIG } from '../constants.js';

const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.serviceKey
);

export default async (req, context) => {
  // Vérifier la méthode
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { pageId } = await req.json();

    if (!pageId) {
      return new Response(JSON.stringify({ error: 'pageId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Récupérer la page depuis Supabase
    const { data: page, error: pageError } = await supabase
      .from('wiki_pages')
      .select('*')
      .eq('id', pageId)
      .single();

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
      .eq('page_id', pageId)
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

    // 5. Logger le sync
    await supabase.from('git_sync_log').insert({
      page_id: pageId,
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
