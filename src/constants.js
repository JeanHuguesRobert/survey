// centralised app version (single source of truth)
// hardcoded value is the canonical version; CI/CD can override by setting process.env.APP_VERSION at build time
export const APP_VERSION = import.meta.env.APP_VERSION ?? "1.2.6";
export const DEPLOY_DATE = import.meta.env.DEPLOY_DATE ?? "2025-11-06";


export const COLORS = ['#F54928', '#0A3F73', '#FFA726', '#42A5F5', '#66BB6A'];
export const PRIMARY_COLOR = '#F54928'; // Orange #Pertitellu
export const SECONDARY_COLOR = '#0A3F73'; // Bleu Corti Capitale

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyzcR0hiou7CiQTv35Jek8CWgHTBPptps65v76YqISjE64J5tC1PkPVOb_QaIdZ5Vc/exec';

// Configuration générique (commune, mouvement, liste)
export const CITY_NAME = import.meta.env.VITE_CITY_NAME || 'Corte';
export const CITY_TAGLINE = import.meta.env.VITE_CITY_TAGLINE || 'CAPITALE';
export const MOVEMENT_NAME = import.meta.env.VITE_MOVEMENT_NAME || "Pertitellu";
export const PARTY_NAME = import.meta.env.VITE_PARTY_NAME || 'Petit Parti';
export const HASHTAG = import.meta.env.VITE_HASHTAG || '#PERTITELLU';
export const BOT_NAME = import.meta.env.VITE_BOT_NAME || 'Ophélia';
export const VOLUNTEER_URL = import.meta.env.VITE_VOLUNTEER_URL || 'https://entraide-cortenaise.lovable.app/';

// Configuration type de communauté
export const COMMUNITY_NAME = import.meta.env.VITE_COMMUNITY_NAME || CITY_NAME;
export const COMMUNITY_TYPE = import.meta.env.VITE_COMMUNITY_TYPE || 'municipality';

// Configuration des libellés par type de communauté
export const COMMUNITY_LABELS = {
  municipality: {
    name: 'commune',
    governance: 'conseil municipal',
    meeting: 'séance du conseil',
    decision: 'délibération',
    representative: 'élu',
    citizens: 'citoyens',
    transparency: 'transparence municipale'
  },
  association: {
    name: 'association',
    governance: 'conseil d\'administration',
    meeting: 'assemblée générale',
    decision: 'résolution',
    representative: 'membre du bureau',
    citizens: 'adhérents',
    transparency: 'transparence associative'
  },
  school: {
    name: 'établissement',
    governance: 'conseil d\'administration',
    meeting: 'conseil d\'école',
    decision: 'décision',
    representative: 'représentant',
    citizens: 'communauté éducative',
    transparency: 'transparence scolaire'
  },
  company: {
    name: 'entreprise',
    governance: 'comité de direction',
    meeting: 'réunion d\'équipe',
    decision: 'décision',
    representative: 'manager',
    citizens: 'collaborateurs',
    transparency: 'transparence d\'entreprise'
  },
  cooperative: {
    name: 'coopérative',
    governance: 'conseil d\'administration',
    meeting: 'assemblée générale',
    decision: 'résolution',
    representative: 'sociétaire',
    citizens: 'coopérateurs',
    transparency: 'transparence coopérative'
  },
  online_community: {
    name: 'communauté',
    governance: 'modération',
    meeting: 'assemblée virtuelle',
    decision: 'décision collective',
    representative: 'modérateur',
    citizens: 'membres',
    transparency: 'transparence communautaire'
  },
  neighborhood: {
    name: 'quartier',
    governance: 'comité de quartier',
    meeting: 'réunion de quartier',
    decision: 'décision',
    representative: 'représentant',
    citizens: 'habitants',
    transparency: 'transparence de quartier'
  },
  professional: {
    name: 'organisation professionnelle',
    governance: 'conseil professionnel',
    meeting: 'assemblée professionnelle',
    decision: 'résolution',
    representative: 'représentant professionnel',
    citizens: 'professionnels',
    transparency: 'transparence professionnelle'
  },
  cultural: {
    name: 'communauté culturelle',
    governance: 'comité culturel',
    meeting: 'assemblée culturelle',
    decision: 'décision',
    representative: 'représentant culturel',
    citizens: 'membres',
    transparency: 'transparence culturelle'
  },
  health: {
    name: 'communauté de santé',
    governance: 'comité de santé',
    meeting: 'assemblée de santé',
    decision: 'décision',
    representative: 'représentant',
    citizens: 'membres',
    transparency: 'transparence sanitaire'
  }
};

// Fonction utilitaire pour obtenir les libellés de la communauté actuelle
export const getCommunityLabels = () => COMMUNITY_LABELS[COMMUNITY_TYPE] || COMMUNITY_LABELS.municipality;

// Contact email
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "jeanhuguesrobert@gmail.com";