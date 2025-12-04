// Dynamic metadata initialization
// Extracted from index.html to avoid Vite html-proxy issues

// Récupération des constantes depuis les variables d'environnement
const CITY_NAME = import.meta.env.VITE_CITY_NAME || "Corte";
const PARTY_NAME = import.meta.env.VITE_PARTY_NAME || "Petit Parti";
const SITE_URL = import.meta.env.VITE_APP_URL || "https://lepp.fr";

// Mise à jour dynamique des métadonnées
document.getElementById("page-title").textContent = `Consultation Citoyenne - ${PARTY_NAME}`;
document
  .getElementById("page-description")
  .setAttribute(
    "content",
    `Plateforme de consultation citoyenne pour les élections municipales de ${CITY_NAME}, incluant un wiki collaboratif et un système de propositions citoyennes.`
  );
document
  .getElementById("og-title")
  .setAttribute("content", `Consultation Citoyenne - ${PARTY_NAME}`);
document
  .getElementById("og-description")
  .setAttribute(
    "content",
    `Participez à la démocratie locale de ${CITY_NAME} avec notre plateforme de consultation citoyenne.`
  );

// Ensure an explicit og:image is set (Facebook requires explicit image meta)
const ogImageUrl = `${SITE_URL.replace(/\/$/, "")}/images/og-image.png`;
const ogEl = document.getElementById("og-image");
const twEl = document.getElementById("twitter-image");
if (ogEl) ogEl.setAttribute("content", ogImageUrl);
if (twEl) twEl.setAttribute("content", ogImageUrl);

// Set og:url explicitly for Facebook debugger
const ogUrlEl = document.getElementById("og-url");
if (ogUrlEl) ogUrlEl.setAttribute("content", SITE_URL.replace(/\/$/, ""));
