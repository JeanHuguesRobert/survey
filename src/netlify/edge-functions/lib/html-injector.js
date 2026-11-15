// src/netlify/edge-functions/lib/html-injector.js
import {
  getConfig,
  loadInstanceConfig,
  getAllConfigKeys,
  initializeInstance,
} from "../../../common/config/instanceConfig.edge.js";
import { applyFilters } from "./ote-filters.js";

/**
 * Injecte les métadonnées dynamiques dans le HTML
 */
export async function injectMetadata(response, instance, subdomain) {
  // Sécurité : Ne traiter QUE les fichiers HTML
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

  // Ne pas traiter les assets statiques même s'ils ont été mal interceptés
  const url = new URL(response.url);
  const isAsset = url.pathname.match(
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|map)$/i
  );
  if (isAsset) {
    return response;
  }

  let html = await response.text();

  // 0. Gestion des inclusions {{ #INCLUDE "path" }}
  // On le fait en premier pour que le contenu inclus soit aussi traité par les variables/IF
  const MAX_INCLUDE_DEPTH = 3;
  let currentDepth = 0;

  async function processIncludes(content, depth) {
    if (depth >= MAX_INCLUDE_DEPTH) return content;

    const includeRegex = /\{\{\s*#\s*INCLUDE\s+["']?([^"'\s}]+)["']?\s*\}\}/gi;
    const matches = Array.from(content.matchAll(includeRegex));

    if (matches.length === 0) return content;

    let newContent = content;
    for (const match of matches) {
      const fullTag = match[0];
      const includePath = match[1];

      try {
        // Résoudre le chemin par rapport à l'URL actuelle
        const includeUrl = new URL(includePath, response.url);
        console.log(`[html-injector] Including file: ${includePath} (Depth: ${depth})`);

        // Fetch le contenu (Netlify Edge Functions supporte fetch pour les assets locaux)
        const includeResponse = await fetch(includeUrl, {
          headers: { "X-Ophelia-Internal": "1" }, // Marqueur pour éviter les boucles infinies d'Edge Functions
        });

        if (includeResponse.ok) {
          let includeText = await includeResponse.text();
          // Traiter récursivement les inclusions dans le fichier inclus
          includeText = await processIncludes(includeText, depth + 1);
          newContent = newContent.replace(fullTag, includeText);
        } else {
          console.error(
            `[html-injector] Failed to include ${includePath}: ${includeResponse.statusText}`
          );
          newContent = newContent.replace(
            fullTag,
            `<!-- Error: Could not include ${includePath} -->`
          );
        }
      } catch (err) {
        console.error(`[html-injector] Error including ${includePath}:`, err.message);
        newContent = newContent.replace(fullTag, `<!-- Error: ${err.message} -->`);
      }
    }
    return newContent;
  }

  html = await processIncludes(html, 0);

  // 0.5. Supprimer les commentaires {{ ! ... }}
  html = html.replace(/\{\{\s*![\s\S]*?\}\}/g, "");

  // 1. Charger la config complète de l'instance si fournie
  if (instance && instance.supabase_url) {
    try {
      // S'assurer qu'on utilise le mode non-admin pour l'instance spécifique
      await initializeInstance(null, false);
      await loadInstanceConfig(true, {
        supabaseUrl: instance.supabase_url,
        supabaseAnonKey: instance.supabase_anon_key,
      });
    } catch (err) {
      console.error("[html-injector] Failed to load instance config:", err.message);
    }
  } else {
    // Sinon on s'assure que la config par défaut est chargée
    try {
      await loadInstanceConfig(false);
    } catch (err) {
      console.error("[html-injector] Failed to load default config:", err.message);
    }
  }

  // 2. Récupérer les valeurs de config
  const communityName =
    getConfig("community_name") ||
    getConfig("city_name") ||
    (instance && instance.display_name) ||
    "Consultation Citoyenne";
  const communityTagline = getConfig("community_tagline") || "Plateforme de consultation citoyenne";
  const appUrl =
    getConfig("app_url") || (subdomain ? `https://${subdomain}.lepp.fr` : "https://lepp.fr");
  const fbAppId = getConfig("facebook_app_id") || "";
  const hashtag = getConfig("hashtag") || "#PERTITELLU";

  // Créer un objet de contexte dynamique à partir de toutes les clés de config
  const context = {};
  getAllConfigKeys().forEach((key) => {
    context[key.toUpperCase()] = getConfig(key);
  });

  // Ajouter/Surcharger les valeurs calculées ou prioritaires
  context.COMMUNITY_NAME = communityName;
  context.COMMUNITY_TAGLINE = communityTagline;
  context.APP_URL = appUrl.replace(/\/$/, "");
  context.FACEBOOK_APP_ID = fbAppId;
  context.HASHTAG = hashtag;

  console.log(
    `[html-injector] Injecting metadata: name="${communityName}", appId="${fbAppId}", subdomain="${subdomain || "root"}"`
  );

  // 3. Effectuer les remplacements

  // A. Gestion des blocs conditionnels {{#IF KEY}}, {{#IFNOT KEY}}, {{#UNLESS KEY}}
  // Supporte les espaces et l'insensibilité à la casse.
  // La fermeture doit correspondre au mot-clé d'ouverture (ex: {{/IFNOT}})
  html = html.replace(
    /\{\{\s*#\s*(IF|IFNOT|UNLESS)\s+([A-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/gi,
    (match, type, key, content) => {
      // On cherche dans le contexte, sinon via getConfig
      const value = context[key.toUpperCase()] || getConfig(key);
      const isTrue = value && value !== "" && value !== "false" && value !== "0" && value !== 0;

      // Logique inversée pour IFNOT et UNLESS
      const conditionMet = type.toUpperCase() === "IF" ? isTrue : !isTrue;

      console.log(
        `[html-injector] Block ${type.toUpperCase()} for "${key}": ${conditionMet ? "KEEP" : "REMOVE"}`
      );
      return conditionMet ? content : "";
    }
  );

  // B. Gestion des blocs de comparaison d'égalité {{#IFIS KEY VALUE}} ou {{#IFEQ KEY VALUE}}
  // Supporte {{#IFIS KEY "value"}}, {{#IFIS KEY value}}, {{#IFNOTIS KEY "value"}}, etc.
  // Ajout du support pour les comparaisons numériques et de sous-chaînes :
  // IFGT (Greater Than), IFGE (Greater or Equal), IFLT (Less Than), IFLE (Less or Equal)
  // IFCONTAINS (Contient la sous-chaîne)
  html = html.replace(
    /\{\{\s*#\s*(IFIS|IFEQ|IFNOTIS|IFNEQ|IFGT|IFGE|IFLT|IFLE|IFCONTAINS|IFIN)\s+([A-Z0-9_]+)\s+["']?([^"'}]+)["']?\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/gi,
    (match, type, key, targetValue, content) => {
      const rawValue = context[key.toUpperCase()] || getConfig(key) || "";
      const value = String(rawValue).trim();
      const target = targetValue.trim().replace(/^["']|["']$/g, "");
      const typeUpper = type.toUpperCase();

      let conditionMet = false;

      // 1. Comparaisons d'égalité
      if (typeUpper === "IFIS" || typeUpper === "IFEQ")
        conditionMet = value.toLowerCase() === target.toLowerCase();
      else if (typeUpper === "IFNOTIS" || typeUpper === "IFNEQ")
        conditionMet = value.toLowerCase() !== target.toLowerCase();
      // 2. Comparaisons numériques (float)
      else if (["IFGT", "IFGE", "IFLT", "IFLE"].includes(typeUpper)) {
        const numValue = parseFloat(value);
        const numTarget = parseFloat(target);
        if (!isNaN(numValue) && !isNaN(numTarget)) {
          if (typeUpper === "IFGT") conditionMet = numValue > numTarget;
          if (typeUpper === "IFGE") conditionMet = numValue >= numTarget;
          if (typeUpper === "IFLT") conditionMet = numValue < numTarget;
          if (typeUpper === "IFLE") conditionMet = numValue <= numTarget;
        }
      }

      // 3. Comparaisons de contenu
      else if (typeUpper === "IFCONTAINS" || typeUpper === "IFIN") {
        conditionMet = value.toLowerCase().includes(target.toLowerCase());
      }

      console.log(
        `[html-injector] Block ${typeUpper} for "${key}" ("${value}") vs "${target}": ${conditionMet ? "KEEP" : "REMOVE"}`
      );
      return conditionMet ? content : "";
    }
  );

  // D. Remplacement générique avec support des Filtres et Fallbacks
  // Syntaxe supportée : {{ KEY }} ou {{ KEY | filter1 | filter2 }} ou {{ KEY || "fallback" }}
  html = html.replace(
    /\{\{\s*([A-Z0-9_]+)(?:\s*(?:\|\||\|)\s*([^}]+))?\s*\}\}/g,
    (match, key, extra) => {
      // On cherche dans le contexte, sinon via getConfig
      let value = context[key.toUpperCase()] || getConfig(key);

      // Gestion du fallback (|| "valeur")
      if (
        (value === undefined || value === null || value === "") &&
        extra &&
        match.includes("||")
      ) {
        value = extra.trim().replace(/^["']|["']$/g, "");
      }

      // Si on n'a toujours pas de valeur, on vide le tag
      if (value === undefined || value === null) {
        return "";
      }

      // Gestion des filtres (support du chaînage et des arguments via ote-filters.js)
      if (extra && match.includes("|") && !match.includes("||")) {
        const filterChain = extra
          .split("|")
          .map((f) => f.trim())
          .filter((f) => f !== "");
        value = applyFilters(value, filterChain);
      }

      return value;
    }
  );

  // E. Nettoyage final des tags orphelins (sécurité renforcée)
  // Supprime tout ce qui ressemble à {{ ... }} résiduel
  html = html.replace(/\{\{\s*[#\/]?[A-Z0-9_]+[\s\S]*?\}\}/g, "");

  // Remplacements des placeholders spécifiques (compatibilité avec %VITE_% pour l'instant)
  html = html.replace(/%VITE_APP_URL%/g, context.APP_URL);
  html = html.replace(/%VITE_FACEBOOK_APP_ID%/g, context.FACEBOOK_APP_ID);

  // Remplacement du titre de la page (sécurité si {{ }} absent)
  if (!html.includes(communityName)) {
    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title id="page-title">${communityName}</title>`
    );
  }

  // Remplacement des métadonnées SEO (Description) - Sécurité si {{ }} absent
  if (!html.includes(communityTagline)) {
    html = html.replace(
      /<meta[^>]*name=["']description["'][^>]*content=["'][^"']*["'][^>]*>/i,
      `<meta name="description" id="page-description" content="${communityTagline}" />`
    );
  }

  // Remplacement des OpenGraph tags - Sécurité si {{ }} absent
  if (!html.includes(`content="${communityName}"`)) {
    html = html.replace(
      /<meta[^>]*property=["']og:title["'][^>]*content=["'][^"']*["'][^>]*>/i,
      `<meta property="og:title" id="og-title" content="${communityName}" />`
    );
  }

  if (!html.includes(`content="${communityTagline}"`)) {
    html = html.replace(
      /<meta[^>]*property=["']og:description["'][^>]*content=["'][^"']*["'][^>]*>/i,
      `<meta property="og:description" id="og-description" content="${communityTagline}" />`
    );
  }

  // Remplacement des images (OG et Twitter)
  const imageUrl = `${context.APP_URL}/images/og-image.png`;
  html = html.replace(
    /<meta[^>]*property=["']og:image["'][^>]*content=["'][^"']*["'][^>]*>/i,
    `<meta property="og:image" id="og-image" content="${imageUrl}" />`
  );

  html = html.replace(
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["'][^"']*["'][^>]*>/i,
    `<meta name="twitter:image" id="twitter-image" content="${imageUrl}" />`
  );

  // Hashtag et Ville si présents (ex: dans les headers ou pieds de page)
  html = html.replace(/>#PERTITELLU</g, `>${hashtag}<`);
  html = html.replace(/>CORTE</g, `>${communityName.toUpperCase()}<`);

  return new Response(html, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
