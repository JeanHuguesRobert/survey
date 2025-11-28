// src/App.jsx

import { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Methodologie from "./pages/Methodologie";
import GestureHeaderMenu from "./components/layout/GestureHeaderMenu";
import {
  GOOGLE_SCRIPT_URL,
  COLORS,
  CITY_NAME,
  CITY_TAGLINE,
  MOVEMENT_NAME,
  PARTY_NAME,
  HASHTAG,
  COMMUNITY_NAME,
  COMMUNITY_TYPE,
  getCommunityLabels,
} from "./constants";
import {
  getCommunityQuestionnaireModules,
  generateInitialFormState,
} from "./config/questionnaireModules";
import Audit from "./pages/Audit";
import Kudocracy from "./pages/Kudocracy";
import Wiki from "./pages/Wiki";
import WikiPage from "./pages/WikiPage";
import WikiCreate from "./pages/WikiCreate";
import WikiEdit from "./pages/WikiEdit";
import Bob from "./pages/Bob";
import Proposition from "./pages/Proposition";
import Transparence from "./pages/Transparence";
import Survey from "./pages/Survey";
import SiteFooter from "./components/layout/SiteFooter";
import { LegalPage } from "./components/common/LegalLinks";
import PublicBrowser from "./components/features/PublicBrowser";
import Social from "./pages/Social";
import GroupPage from "./pages/GroupPage";
import GroupCreate from "./pages/GroupCreate";
import PostPage from "./pages/PostPage";
import PostCreate from "./pages/PostCreate";
import UserProfile from "./pages/UserProfile";
import VotingDashboard from "./pages/VotingDashboard";
import UserDashboard from "./pages/UserDashboard";
import GlobalDashboard from "./pages/GlobalDashboard";
import WikiDashboard from "./pages/WikiDashboard";
import SocialDashboard from "./pages/SocialDashboard";
import SubscriptionFeed from "./pages/SubscriptionFeed";
import { supabase } from "./lib/supabase";
import { useCurrentUser } from "./lib/useCurrentUser";
import AuthModal from "./components/common/AuthModal";
import GlobalStatusIndicator from "./components/common/GlobalStatusIndicator";
import JobMonitorDemo from "./components/examples/JobMonitorDemo";
import Contact from "./pages/Contact";
import FacebookDeletionInstructions from "./pages/FacebookDeletionInstructions";
import FacebookDeletionStatus from "./pages/FacebookDeletionStatus";
import DataCollector from "./pages/DataCollector";
import DataReview from "./pages/admin/DataReview";
import Gazette from "./pages/Gazette";
import NotFound from "./pages/NotFound";

export default function Consultation() {
  // Feature flag for gesture header menu
  const USE_GESTURE_HEADER_MENU = true; // Set to false to revert to modal hamburger
  const [page, setPage] = useState("form");
  const baseInitialState = generateInitialFormState(COMMUNITY_TYPE);
  const [formData, setFormData] = useState({
    ...baseInitialState,
    satisfactionDemocratie: baseInitialState.satisfactionDemocratie ?? 3,
    declinVille: 3,
    favorableReferendum: "",
    sujetsReferendum: [],
    inscritListe: "",
    quartier: "",
    age: "",
    dureeHabitation: "",
    email: "",
    participationEtudeIA: false,
    horaireConseil: "",
    commentaire: "",
  });
  const [responses, setResponses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(() => {
    const saved = localStorage.getItem("formOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { currentUser, loading, error: userError, userStatus } = useCurrentUser();
  const isCorte = String(CITY_NAME || "").toLowerCase() === "corte";
  const modules = getCommunityQuestionnaireModules(COMMUNITY_TYPE);

  // Persist form open/closed state
  useEffect(() => {
    localStorage.setItem("formOpen", JSON.stringify(isFormOpen));
  }, [isFormOpen]);

  // Charger les réponses depuis Google Sheets
  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const data = await response.json();

      if (data.success && data.data) {
        const formattedResponses = data.data.map((row) => ({
          connaissanceQuasquara: row["Connaissance Quasquara"] || "",
          positionQuasquara: row["Position Quasquara"] || "",
          quiDecide: row["Qui décide"] || "",
          satisfactionDemocratie: parseInt(row["Satisfaction Démocratie"]) || 3,
          favorableReferendum: row["Favorable Référendum"] || "",
          horaireConseil: row["Horaire Conseil"] || "",
          declinVille: parseInt(row["Déclin Ville"]) || 3,
          sujetsReferendum: row["Sujets Référendum"] ? row["Sujets Référendum"].split(", ") : [],
          age: row["Âge"] || "",
          dureeHabitation: row["Durée Habitation"] || "",
        }));
        setResponses(formattedResponses);
      }
    } catch (err) {
      console.error("Erreur chargement:", err);
      // En cas d'erreur, utiliser des données de démo
      setResponses([
        {
          connaissanceQuasquara: "Oui",
          positionQuasquara: "Maintien",
          quiDecide: "Référendum des habitants",
          satisfactionDemocratie: 2,
          favorableReferendum: "Oui",
          sujetsReferendum: ["culture", "patrimoine"],
          age: "41-60",
          dureeHabitation: ">10 ans",
        },
      ]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && name === "sujetsReferendum") {
      setFormData((prev) => ({
        ...prev,
        sujetsReferendum: checked
          ? [...prev.sujetsReferendum, value]
          : prev.sujetsReferendum.filter((s) => s !== value),
      }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    setFormLoading(true);
    setError("");

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      setSubmitted(true);

      setTimeout(async () => {
        await loadResponses();
        setPage("results");
        setSubmitted(false);
        setFormLoading(false);
      }, 2000);
    } catch (err) {
      console.error("Erreur soumission:", err);
      setError("Erreur lors de l'envoi. Veuillez réessayer.");
      setFormLoading(false);
    }
  };

  const calculateStats = () => {
    if (responses.length === 0) return null;

    const connaissanceData = [
      { name: "Oui", value: responses.filter((r) => r.connaissanceQuasquara === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.connaissanceQuasquara === "Non").length },
    ];

    const positionData = [
      {
        name: "Maintien",
        value: responses.filter((r) => r.positionQuasquara === "Maintien").length,
      },
      { name: "Retrait", value: responses.filter((r) => r.positionQuasquara === "Retrait").length },
      { name: "Sans avis", value: responses.filter((r) => r.positionQuasquara === "Sans").length },
    ];

    const decisionData = [
      { name: "Justice", value: responses.filter((r) => r.quiDecide === "Justice").length },
      { name: "Élus locaux", value: responses.filter((r) => r.quiDecide === "Élus locaux").length },
      {
        name: "Référendum",
        value: responses.filter((r) => r.quiDecide === "Référendum des habitants").length,
      },
      { name: "Autre", value: responses.filter((r) => r.quiDecide === "Autre").length },
    ];

    const horaireConseilData = [
      { name: "Oui", value: responses.filter((r) => r.horaireConseil === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.horaireConseil === "Non").length },
      {
        name: "Je ne sais pas",
        value: responses.filter((r) => r.horaireConseil === "Je ne sais pas").length,
      },
      {
        name: "Je préfère ne pas répondre",
        value: responses.filter((r) => r.horaireConseil === "Je préfère ne pas répondre").length,
      },
    ];

    const satisfactionMoyenne =
      responses.reduce((acc, r) => acc + r.satisfactionDemocratie, 0) / responses.length;
    const declinMoyen =
      responses.reduce((acc, r) => acc + parseInt(r.declinVille || 3), 0) / responses.length;

    const referendumData = [
      { name: "Oui", value: responses.filter((r) => r.favorableReferendum === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.favorableReferendum === "Non").length },
      {
        name: "Selon sujets",
        value: responses.filter((r) => r.favorableReferendum === "Selon").length,
      },
    ];

    const sujetsCount = {};
    responses.forEach((r) => {
      r.sujetsReferendum.forEach((sujet) => {
        sujetsCount[sujet] = (sujetsCount[sujet] || 0) + 1;
      });
    });
    const sujetsData = Object.entries(sujetsCount).map(([name, value]) => ({ name, value }));

    return {
      connaissanceData,
      positionData,
      decisionData,
      horaireConseilData,
      satisfactionMoyenne,
      declinMoyen,
      referendumData,
      sujetsData,
      totalResponses: responses.length,
    };
  };

  const handleShare = async () => {
    const shareData = {
      title: `Consultation citoyenne ${MOVEMENT_NAME}`,
      text: `Participez à la consultation citoyenne sur la démocratie locale à ${CITY_NAME}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Lien copié dans le presse-papier !");
      }
    } catch (err) {
      console.error("Erreur lors du partage:", err);
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  const stats = calculateStats();

  if (page === "form") {
    return (
      <div className="app-shell">
        <a href="#mainContent" className="skip-link">
          Aller au contenu principal
        </a>
        {USE_GESTURE_HEADER_MENU ? (
          <GestureHeaderMenu />
        ) : (
          <>
            <header className="site-header">
              <div className="site-header-inner">
                <button
                  type="button"
                  className="nav-toggle"
                  aria-label={isMenuOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
                  aria-expanded={isMenuOpen}
                  aria-controls="mainNav"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                >
                  <div className="relative h-6 w-6">
                    <span
                      className={`absolute left-1 top-1 block h-0.5 w-4 rounded-sm bg-light transition-transform duration-300 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
                    />
                    <span
                      className={`absolute left-1 top-2.5 block h-0.5 w-4 rounded-sm bg-light transition-opacity duration-300 ${isMenuOpen ? "opacity-0" : "opacity-100"}`}
                    />
                    <span
                      className={`absolute left-1 top-4 block h-0.5 w-4 rounded-sm bg-light transition-transform duration-300 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
                    />
                  </div>
                  <span className="sr-only">
                    {isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                  </span>
                </button>
              </div>
            </header>
            {isMenuOpen && (
              <div className="nav-overlay" onClick={closeMenu}>
                <nav
                  id="mainNav"
                  role="navigation"
                  aria-labelledby="navTitle"
                  className="nav-panel theme-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span id="navTitle" className="nav-title">
                      Navigation {MOVEMENT_NAME}
                    </span>
                    <button
                      type="button"
                      className="nav-toggle"
                      onClick={closeMenu}
                      aria-label="Fermer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <ul className="nav-list">
                    <li className="nav-item">
                      <Link to="/" onClick={closeMenu} className="nav-link">
                        Consultation
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/kudocracy" onClick={closeMenu} className="nav-link">
                        Propositions
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/wiki" onClick={closeMenu} className="nav-link">
                        Wiki
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/bob" onClick={closeMenu} className="nav-link">
                        Ophélia
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/social" onClick={closeMenu} className="nav-link">
                        Café
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/transparence" onClick={closeMenu} className="nav-link">
                        Transparence
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/methodologie" onClick={closeMenu} className="nav-link">
                        Méthodologie
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/audit" onClick={closeMenu} className="nav-link">
                        Audit
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/global-dashboard" onClick={closeMenu} className="nav-link">
                        📊 Tableau de bord
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/wiki-dashboard" onClick={closeMenu} className="nav-link">
                        📖 Vos contributions Wiki
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/social-dashboard" onClick={closeMenu} className="nav-link">
                        💬 Vos contributions sociales
                      </Link>
                    </li>
                    {currentUser && (
                      <li className="nav-item">
                        <Link to="/subscriptions" onClick={closeMenu} className="nav-link">
                          🔔 Vos abonnements
                        </Link>
                      </li>
                    )}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {currentUser ? (
                      <div className="px-3 py-2">
                        <div className="text-xs text-gray-400 mb-2">👤 Connecté en tant que:</div>
                        <div className="text-sm font-medium text-light mb-3">
                          {currentUser.display_name || currentUser.email}
                        </div>
                        <Link
                          to="/user-dashboard"
                          onClick={closeMenu}
                          className="block w-full px-3 py-2 mb-2 text-sm text-center bg-primary text-light font-bold border-2 border-light hover:bg-primary hover:opacity-90"
                        >
                          Votre tableau de bord
                        </Link>
                        <button
                          onClick={async () => {
                            await supabase.auth.signOut();
                            closeMenu();
                          }}
                          className="w-full px-3 py-2 text-sm bg-accent text-light font-bold border-2 border-light hover:opacity-90"
                        >
                          Déconnexion
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAuthModal(true);
                          closeMenu();
                        }}
                        className="w-full px-3 py-2 text-sm bg-highlight text-dark font-bold border-2 border-dark hover:opacity-90"
                      >
                        🔐 Connexion / Inscription
                      </button>
                    )}
                  </div>
                  <div className="mt-6 text-xs text-gray-400">
                    {PARTY_NAME} — {MOVEMENT_NAME} {CITY_NAME} © {new Date().getFullYear()}
                  </div>
                </nav>
              </div>
            )}
          </>
        )}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">{HASHTAG}</div>
            <div className="h-1 my-3 max-w-2xl mx-auto bg-highlight"></div>
            <div className="text-4xl font-bold text-accent">
              {String(CITY_NAME).toUpperCase()}
              <br />
              {CITY_TAGLINE}
            </div>
          </div>
        </div>
        <main className="landing-main">
          {submitted ? (
            <div className="theme-card success-message">
              <h2>Merci pour votre participation !</h2>
              <p>Votre réponse a été enregistrée. Redirection vers les résultats...</p>
            </div>
          ) : (
            <div className="landing-card">
              <button
                type="button"
                onClick={() => setIsFormOpen((open) => !open)}
                className="landing-card-header"
              >
                <span>Questionnaire citoyen {MOVEMENT_NAME}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform ${isFormOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isFormOpen && isCorte && (
                <div id="mainContent" className="landing-card-body">
                  <h1 className="page-title">
                    Consultation {getCommunityLabels().citizens} sur la démocratie locale
                  </h1>
                  <p className="section-description">
                    Une initiative {MOVEMENT_NAME} pour la {getCommunityLabels().name} de{" "}
                    {COMMUNITY_NAME}
                  </p>

                  {error && (
                    <div className="bg-accent border-2 border-accent p-4 mb-6 text-light">
                      {error}
                    </div>
                  )}

                  <div className="landing-content">
                    {/* Modules de questionnaire dynamiques */}
                    <div className="question-set">
                      <h2 className="section-title">{modules.title}</h2>
                      {modules.modules.map((module) => (
                        <div key={module.id} className="question-group">
                          <h3 className="subsection-title">{module.title}</h3>
                          {module.questions.map((q) => (
                            <div key={q.id} className="question-group">
                              <label className="form-label">{q.label}</label>
                              {q.type === "radio" && (
                                <div className="choice-group">
                                  {q.options.map((opt) => (
                                    <label key={opt} className="choice-label">
                                      <input
                                        type="radio"
                                        name={q.id}
                                        value={opt}
                                        checked={formData[q.id] === opt}
                                        onChange={handleInputChange}
                                      />
                                      {opt}
                                    </label>
                                  ))}
                                </div>
                              )}
                              {q.type === "scale" && (
                                <div>
                                  <div className="md:hidden">
                                    <select
                                      name={q.id}
                                      value={formData[q.id] ?? 3}
                                      onChange={handleInputChange}
                                      className="w-full"
                                    >
                                      <option value="1">{q.labels?.[0] || "1"}</option>
                                      <option value="2">{q.labels?.[1] || "2"}</option>
                                      <option value="3">{q.labels?.[2] || "3"}</option>
                                      <option value="4">{q.labels?.[3] || "4"}</option>
                                      <option value="5">{q.labels?.[4] || "5"}</option>
                                    </select>
                                  </div>
                                  <div className="hidden md:flex items-center space-x-4">
                                    <span className="hint-text">{q.labels?.[0] || "1"}</span>
                                    {[1, 2, 3, 4, 5].map((num) => (
                                      <label key={num} className="choice-label">
                                        <input
                                          type="radio"
                                          name={q.id}
                                          value={num}
                                          checked={Number(formData[q.id] ?? 3) === num}
                                          onChange={handleInputChange}
                                        />
                                        {num}
                                      </label>
                                    ))}
                                    <span className="hint-text">{q.labels?.[4] || "5"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="bordered-section bordered-section-primary question-set">
                      <h2 className="section-title">L'affaire de Quasquara</h2>

                      <div className="question-group">
                        <label className="form-label">
                          Connaissez-vous la polémique sur la croix de Quasquara ?
                        </label>
                        <div className="choice-group">
                          {["Oui", "Non"].map((option) => (
                            <label key={option} className="choice-label">
                              <input
                                type="radio"
                                name="connaissanceQuasquara"
                                value={option}
                                checked={formData.connaissanceQuasquara === option}
                                onChange={handleInputChange}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Quelle est votre position sur cette affaire ?
                        </label>
                        <div className="choice-group">
                          {[
                            { label: "Maintien de la croix", value: "Maintien" },
                            { label: "Retrait de la croix", value: "Retrait" },
                            { label: "Sans avis", value: "Sans" },
                            { label: "Je préfère ne pas répondre", value: "NoAnswer" },
                          ].map((option) => (
                            <label key={option.value} className="choice-label">
                              <input
                                type="radio"
                                name="positionQuasquara"
                                value={option.value}
                                checked={formData.positionQuasquara === option.value}
                                onChange={handleInputChange}
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Qui devrait décider dans ce type de situation ?
                        </label>
                        <div className="choice-group">
                          {["Justice", "Élus locaux", "Référendum des habitants", "Autre"].map(
                            (option) => (
                              <label key={option} className="choice-label">
                                <input
                                  type="radio"
                                  name="quiDecide"
                                  value={option}
                                  checked={formData.quiDecide === option}
                                  onChange={handleInputChange}
                                />
                                {option}
                              </label>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bordered-section bordered-section-accent question-set">
                      <h2 className="section-title">Démocratie {getCommunityLabels().name}</h2>

                      <div className="question-group">
                        <label className="form-label">
                          Êtes-vous satisfait de la démocratie locale actuelle ?
                        </label>
                        <div className="md:hidden">
                          <select
                            name="satisfactionDemocratie"
                            value={formData.satisfactionDemocratie}
                            onChange={handleInputChange}
                            className="w-full"
                          >
                            <option value="">Je préfère ne pas répondre</option>
                            <option value="1">1 - Pas du tout satisfait</option>
                            <option value="2">2 - Peu satisfait</option>
                            <option value="3">3 - Moyennement satisfait</option>
                            <option value="4">4 - Satisfait</option>
                            <option value="5">5 - Très satisfait</option>
                          </select>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                          <span className="hint-text">Pas du tout (1)</span>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <label key={num} className="choice-label">
                              <input
                                type="radio"
                                name="satisfactionDemocratie"
                                value={num}
                                checked={Number(formData.satisfactionDemocratie) === num}
                                onChange={handleInputChange}
                              />
                              {num}
                            </label>
                          ))}
                          <span className="hint-text">Très satisfait (5)</span>
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Pensez-vous que {CITY_NAME} est en déclin ?
                        </label>
                        <div className="md:hidden">
                          <select
                            name="declinVille"
                            value={formData.declinVille}
                            onChange={handleInputChange}
                            className="w-full"
                          >
                            <option value="">Je préfère ne pas répondre</option>
                            <option value="1">1 - En développement</option>
                            <option value="2">2 - Plutôt en développement</option>
                            <option value="3">3 - Stable</option>
                            <option value="4">4 - Plutôt en déclin</option>
                            <option value="5">5 - En fort déclin</option>
                          </select>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                          <span className="hint-text">En développement (1)</span>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <label key={num} className="choice-label">
                              <input
                                type="radio"
                                name="declinVille"
                                value={num}
                                checked={Number(formData.declinVille) === num}
                                onChange={handleInputChange}
                              />
                              {num}
                            </label>
                          ))}
                          <span className="hint-text">En déclin (5)</span>
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Seriez-vous favorable à des référendums locaux sur des questions
                          importantes ?
                        </label>
                        <div className="choice-group">
                          {[
                            { label: "Oui", value: "Oui" },
                            { label: "Non", value: "Non" },
                            { label: "Selon les sujets", value: "Selon" },
                          ].map((option) => (
                            <label key={option.value} className="choice-label">
                              <input
                                type="radio"
                                name="favorableReferendum"
                                value={option.value}
                                checked={formData.favorableReferendum === option.value}
                                onChange={handleInputChange}
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Sur quels sujets ces référendums devraient-ils porter ? (choix multiples)
                        </label>
                        <div className="choice-group">
                          {[
                            "urbanisme",
                            "culture",
                            "budget",
                            "environnement",
                            "patrimoine",
                            "autre",
                          ].map((option) => (
                            <label key={option} className="choice-label">
                              <input
                                type="checkbox"
                                name="sujetsReferendum"
                                value={option}
                                checked={formData.sujetsReferendum.includes(option)}
                                onChange={handleInputChange}
                              />
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Les horaires actuels des conseils municipaux vous paraissent-ils pratiques
                          ?
                        </label>
                        <div className="choice-group">
                          {["Oui", "Non", "Je ne sais pas", "Je préfère ne pas répondre"].map(
                            (option) => (
                              <label key={option} className="choice-label">
                                <input
                                  type="radio"
                                  name="horaireConseil"
                                  value={option}
                                  checked={formData.horaireConseil === option}
                                  onChange={handleInputChange}
                                />
                                {option}
                              </label>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bordered-section bordered-section-primary question-set">
                      <h2 className="section-title">
                        Profil{" "}
                        <span className="helper-text">
                          (toutes les questions sont optionnelles)
                        </span>
                      </h2>

                      <div className="question-group">
                        <label className="form-label">
                          Êtes-vous inscrit(e) sur les listes électorales à {CITY_NAME} ?
                        </label>
                        <div className="choice-group">
                          {[
                            "Oui",
                            "Non",
                            "Pas encore mais je compte le faire",
                            "Je ne souhaite pas répondre",
                          ].map((option) => (
                            <label key={option} className="choice-label">
                              <input
                                type="radio"
                                name="inscritListe"
                                value={option}
                                checked={formData.inscritListe === option}
                                onChange={handleInputChange}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="question-group">
                        <label className="form-label--emphasis">Quartier de {CITY_NAME}</label>
                        <input
                          type="text"
                          name="quartier"
                          value={formData.quartier}
                          onChange={handleInputChange}
                          className="w-full"
                          placeholder="Ex: Centre-ville, Citadelle..."
                        />
                      </div>

                      <div className="question-group">
                        <label className="form-label">Tranche d'âge</label>
                        <select
                          name="age"
                          value={formData.age}
                          onChange={handleInputChange}
                          className="w-full"
                        >
                          <option value="">-- Sélectionnez --</option>
                          <option value="18-25">18-25 ans</option>
                          <option value="26-40">26-40 ans</option>
                          <option value="41-60">41-60 ans</option>
                          <option value="60+">60 ans et plus</option>
                        </select>
                      </div>

                      <div className="question-group">
                        <label className="form-label">
                          Depuis combien de temps habitez-vous {CITY_NAME} ?
                        </label>
                        <select
                          name="dureeHabitation"
                          value={formData.dureeHabitation}
                          onChange={handleInputChange}
                          className="w-full"
                        >
                          <option value="">-- Sélectionnez --</option>
                          <option value="<1 an">Moins d'1 an</option>
                          <option value="1-5 ans">1 à 5 ans</option>
                          <option value="5-10 ans">5 à 10 ans</option>
                          <option value=">10 ans">Plus de 10 ans</option>
                          <option value="toute ma vie">Toute ma vie</option>
                        </select>
                      </div>
                    </div>

                    <div className="bordered-section bordered-section-accent question-set">
                      <div className="question-group">
                        <label className="form-label">Commentaire libre</label>
                        <textarea
                          name="commentaire"
                          value={formData.commentaire}
                          onChange={handleInputChange}
                          rows="4"
                          className="w-full"
                          placeholder="Vos suggestions, remarques..."
                        />
                      </div>

                      <div className="info-box">
                        <label className="form-label">
                          Souhaitez-vous être tenu informé de nos propositions ?
                        </label>
                        <div className="choice-label">
                          <input
                            type="checkbox"
                            name="accepteContact"
                            checked={formData.accepteContact}
                            onChange={handleInputChange}
                          />
                          <span>Oui, je souhaite être contacté</span>
                        </div>
                        {formData.accepteContact && (
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full mt-3"
                            placeholder="Votre email"
                          />
                        )}

                        <div className="choice-label mt-4">
                          <input
                            type="checkbox"
                            name="participationEtudeIA"
                            checked={formData.participationEtudeIA}
                            onChange={handleInputChange}
                          />
                          <span>
                            Je veux aussi participer à l'étude &quot;IA pour tous&quot;
                            <span
                              className="ml-2 inline-block cursor-pointer text-primary hover:opacity-80"
                              title='Informations sur l&apos;étude "IA pour tous"'
                              onClick={() => window.open("https://www.ia-pour-tous.fr", "_blank")}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 inline"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={formLoading}
                      className="btn btn-primary w-full py-3 px-6 text-lg"
                    >
                      {formLoading ? "Envoi en cours..." : "Envoyer votre réponse"}
                    </button>
                  </div>

                  <div className="mt-8 text-center">
                    <div className="flex justify-center gap-4">
                      <button onClick={handleShare} className="btn-secondary-action">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        Partager
                      </button>
                      <button onClick={() => setPage("results")} className="btn-tertiary-action">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Voir les résultats
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a href="#mainContent" className="skip-link">
        Aller au contenu principal
      </a>
      <div className="min-h-screen bg-dark">
        <header className="border-b-2 border-light">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">{HASHTAG}</div>
              <div className="h-1 my-3 max-w-2xl mx-auto bg-highlight"></div>
              <div className="text-4xl font-bold text-accent">
                {String(CITY_NAME).toUpperCase()}
                <br />
                {CITY_TAGLINE}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div
            style={{
              background: "var(--color-bg-app)",
              border: "2px solid var(--color-border-strong)",
              padding: "2rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            {!stats ? (
              <div className="text-center hint-text">Chargement des résultats...</div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h1 className="page-title">Résultats de la consultation</h1>
                    <p className="section-description">
                      {stats?.totalResponses} participation{stats?.totalResponses > 1 ? "s" : ""}{" "}
                      enregistrée{stats?.totalResponses > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button onClick={loadResponses} className="btn btn-secondary">
                    Actualiser
                  </button>
                </div>

                <div className="space-y-12">
                  <section>
                    <h2 className="section-title">Connaissance de l'affaire de Quasquara</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.connaissanceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={window.innerWidth < 768 ? 60 : 80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.connaissanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="px-2 md:px-4">
                    <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 200 : 300}>
                      <BarChart
                        data={stats.positionData}
                        margin={
                          window.innerWidth < 768
                            ? { top: 5, right: 10, left: -20, bottom: 5 }
                            : { top: 5, right: 30, left: 20, bottom: 5 }
                        }
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#B35A4A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>

                  <section>
                    <h2 className="section-title">Qui devrait décider ?</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.decisionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B4E6B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>

                  <section>
                    <h2 className="section-title">Satisfaction de la démocratie locale</h2>
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary">
                        {stats.satisfactionMoyenne.toFixed(1)}/5
                      </div>
                      <p className="hint-text mt-2">Note moyenne</p>
                    </div>
                  </section>

                  <section>
                    <h2 className="section-title">État de {CITY_NAME}</h2>
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary">
                        {stats.declinMoyen.toFixed(1)}/5
                      </div>
                      <p className="hint-text mt-2">1 = En développement, 5 = En déclin</p>
                    </div>
                  </section>

                  <section>
                    <h2 className="section-title">Favorable aux référendums locaux ?</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.referendumData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.referendumData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>

                  {stats.sujetsData.length > 0 && (
                    <section>
                      <h2 className="section-title">Sujets prioritaires pour les référendums</h2>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.sujetsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#B35A4A" />
                        </BarChart>
                      </ResponsiveContainer>
                    </section>
                  )}

                  <section>
                    <h2 className="section-title">Les horaires des conseils municipaux</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats?.horaireConseilData || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats?.horaireConseilData?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>
                </div>
              </>
            )}

            <div className="mt-8 text-center">
              <div className="flex justify-center gap-4">
                <button onClick={() => setPage("form")} className="btn btn-secondary py-3 px-6">
                  Participer à la consultation
                </button>
                <button
                  onClick={handleShare}
                  className="text-accent underline hover:opacity-80 flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  Partager
                </button>
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <GlobalStatusIndicator />
      <Routes>
        <Route path="/" element={<Consultation />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="/transparence" element={<Transparence />} />
        <Route path="/methodologie" element={<Methodologie />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/kudocracy" element={<Kudocracy />} />
        <Route path="/propositions/:id" element={<Proposition />} />
        <Route path="/proposition/:id" element={<Proposition />} />
        <Route path="/bob" element={<Bob />} />
        <Route path="/ophelia" element={<Bob />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/new" element={<WikiCreate />} />
        <Route path="/wiki/new/:slug" element={<WikiCreate />} />
        <Route path="/wiki/:slug" element={<WikiPage />} />
        <Route path="/wiki/:slug/edit" element={<WikiEdit />} />
        <Route path="/legal/terms" element={<LegalPage type="terms" />} />
        <Route path="/legal/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/browser/*" element={<PublicBrowser />} />
        <Route path="/gazette" element={<Gazette />} />
        <Route path="/gazette/:name" element={<Gazette />} />
        <Route path="/admin/data-review" element={<DataReview />} />
        <Route
          path="/oauth/facebook/deletion-instructions"
          element={<FacebookDeletionInstructions />}
        />
        <Route path="/oauth/facebook/deletion-status" element={<FacebookDeletionStatus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
