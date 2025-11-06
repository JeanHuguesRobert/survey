import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Methodologie from './pages/Methodologie';
import { APP_VERSION, DEPLOY_DATE, GOOGLE_SCRIPT_URL, COLORS, PRIMARY_COLOR, SECONDARY_COLOR, CITY_NAME, CITY_TAGLINE, MOVEMENT_NAME, PARTY_NAME, HASHTAG, VOLUNTEER_URL, COMMUNITY_NAME, COMMUNITY_TYPE, getCommunityLabels } from './constants';
import { getCommunityQuestionnaireModules, generateInitialFormState } from './config/questionnaireModules';
import Audit from './pages/Audit';
import Kudocracy from './pages/Kudocracy';
import Wiki from './pages/Wiki';
import WikiPage from './pages/WikiPage';
import WikiCreate from './pages/WikiCreate';
import WikiEdit from './pages/WikiEdit';
import Bob from './pages/Bob';
import Proposition from './pages/Proposition';
import Transparence from './pages/Transparence';
import Survey from './pages/Survey';
import SiteFooter from "./components/layout/SiteFooter";
import { LegalPage } from "./components/LegalLinks";

export default function ConsultationPertitellu() {
  const [page, setPage] = useState('form');
  const baseInitialState = generateInitialFormState(COMMUNITY_TYPE);
  const [formData, setFormData] = useState({
    ...baseInitialState,
    satisfactionDemocratie: baseInitialState.satisfactionDemocratie ?? 3,
    declinVille: 3,
    favorableReferendum: '',
    sujetsReferendum: [],
    inscritListe: '', 
    quartier: '',
    age: '',
    dureeHabitation: '',
    email: '',
    participationEtudeIA: false,
    horaireConseil: '',
    commentaire: ''
  });
  
  const [responses, setResponses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasConsent, setHasConsent] = useState(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const isCorte = String(CITY_NAME || '').toLowerCase() === 'corte';
  const modules = getCommunityQuestionnaireModules(COMMUNITY_TYPE);

  // Charger les réponses depuis Google Sheets
  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const data = await response.json();
      
      if (data.success && data.data) {
        const formattedResponses = data.data.map(row => ({
          connaissanceQuasquara: row['Connaissance Quasquara'] || '',
          positionQuasquara: row['Position Quasquara'] || '',
          quiDecide: row['Qui décide'] || '',
          satisfactionDemocratie: parseInt(row['Satisfaction Démocratie']) || 3,
          favorableReferendum: row['Favorable Référendum'] || '',
          horaireConseil: row['Horaire Conseil'] || '',
          declinVille: parseInt(row['Déclin Ville']) || 3, // Correction du parsing
          sujetsReferendum: row['Sujets Référendum'] ? row['Sujets Référendum'].split(', ') : [],
          age: row['Âge'] || '',
          dureeHabitation: row['Durée Habitation'] || ''
        }));
        setResponses(formattedResponses);
      }
    } catch (err) {
      console.error('Erreur chargement:', err);
      // En cas d'erreur, utiliser des données de démo
      setResponses([
        {
          connaissanceQuasquara: 'Oui',
          positionQuasquara: 'Maintien',
          quiDecide: 'Référendum des habitants',
          satisfactionDemocratie: 2,
          favorableReferendum: 'Oui',
          sujetsReferendum: ['culture', 'patrimoine'],
          age: '41-60',
          dureeHabitation: '>10 ans'
        }
      ]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'sujetsReferendum') {
      setFormData(prev => ({
        ...prev,
        sujetsReferendum: checked 
          ? [...prev.sujetsReferendum, value]
          : prev.sujetsReferendum.filter(s => s !== value)
      }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    // Soumission sans validation spécifique aux anciens champs pour permettre des modules agnostiques

    setLoading(true);
    setError('');

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      // Avec no-cors, on ne peut pas lire la réponse, on assume que ça a fonctionné
      setSubmitted(true);
      
      // Recharger les données après 2 secondes
      setTimeout(async () => {
        await loadResponses();
        setPage('results');
        setSubmitted(false);
        setLoading(false);
      }, 2000);

    } catch (err) {
      console.error('Erreur soumission:', err);
      setError('Erreur lors de l\'envoi. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (responses.length === 0) return null;

    const connaissanceData = [
      { name: 'Oui', value: responses.filter(r => r.connaissanceQuasquara === 'Oui').length },
      { name: 'Non', value: responses.filter(r => r.connaissanceQuasquara === 'Non').length }
    ];

    const positionData = [
      { name: 'Maintien', value: responses.filter(r => r.positionQuasquara === 'Maintien').length },
      { name: 'Retrait', value: responses.filter(r => r.positionQuasquara === 'Retrait').length },
      { name: 'Sans avis', value: responses.filter(r => r.positionQuasquara === 'Sans').length }
    ];

    const decisionData = [
      { name: 'Justice', value: responses.filter(r => r.quiDecide === 'Justice').length },
      { name: 'Élus locaux', value: responses.filter(r => r.quiDecide === 'Élus locaux').length },
      { name: 'Référendum', value: responses.filter(r => r.quiDecide === 'Référendum des habitants').length },
      { name: 'Autre', value: responses.filter(r => r.quiDecide === 'Autre').length }
    ];

    const horaireConseilData = [
      { name: 'Oui', value: responses.filter(r => r.horaireConseil === 'Oui').length },
      { name: 'Non', value: responses.filter(r => r.horaireConseil === 'Non').length },
      { name: 'Je ne sais pas', value: responses.filter(r => r.horaireConseil === 'Je ne sais pas').length },
      { name: 'Je préfère ne pas répondre', value: responses.filter(r => r.horaireConseil === 'Je préfère ne pas répondre').length }
    ];

    const satisfactionMoyenne = responses.reduce((acc, r) => acc + r.satisfactionDemocratie, 0) / responses.length;
    const declinMoyen = responses.reduce((acc, r) => acc + parseInt(r.declinVille || 3), 0) / responses.length;

    const referendumData = [
      { name: 'Oui', value: responses.filter(r => r.favorableReferendum === 'Oui').length },
      { name: 'Non', value: responses.filter(r => r.favorableReferendum === 'Non').length },
      { name: 'Selon sujets', value: responses.filter(r => r.favorableReferendum === 'Selon').length }
    ];

    const sujetsCount = {};
    responses.forEach(r => {
      r.sujetsReferendum.forEach(sujet => {
        sujetsCount[sujet] = (sujetsCount[sujet] || 0) + 1;
      });
    });
    const sujetsData = Object.entries(sujetsCount).map(([name, value]) => ({ name, value }));

    return {
      connaissanceData,
      positionData,
      decisionData,
      horaireConseilData, // Ajout des données pour Horaire Conseil
      satisfactionMoyenne,
      declinMoyen,
      referendumData,
      sujetsData,
      totalResponses: responses.length
    };
  };

  const handleShare = async () => {
    const shareData = {
      title: `Consultation citoyenne ${MOVEMENT_NAME}`,
      text: `Participez à la consultation citoyenne sur la démocratie locale à ${CITY_NAME}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copier le lien dans le presse-papier
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papier !');
      }
    } catch (err) {
      console.error('Erreur lors du partage:', err);
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  const stats = calculateStats();  // Ajout de cette ligne au niveau des autres déclarations d'état

  if (page === 'form') {
    return (
      <div className="min-h-screen bg-gray-50">
        <a href="#mainContent" className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 px-3 py-2 rounded-md bg-white text-slate-900 shadow">Aller au contenu principal</a>
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-start justify-between">
              <button
                type="button"
                className="group flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400"
                aria-label={isMenuOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
                aria-expanded={isMenuOpen}
                aria-controls="mainNav"
                onClick={() => setIsMenuOpen((prev) => !prev)}
              >
                <div className="relative h-6 w-6">
                  <span
                    className={`absolute left-1 top-1 block h-0.5 w-4 rounded-sm transition-transform duration-300 ${isMenuOpen ? 'translate-y-2 rotate-45' : ''}`}
                    style={{ backgroundColor: SECONDARY_COLOR }}
                  />
                  <span
                    className={`absolute left-1 top-2.5 block h-0.5 w-4 rounded-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                    style={{ backgroundColor: SECONDARY_COLOR }}
                  />
                  <span
                    className={`absolute left-1 top-4 block h-0.5 w-4 rounded-sm transition-transform duration-300 ${isMenuOpen ? '-translate-y-2 -rotate-45' : ''}`}
                    style={{ backgroundColor: SECONDARY_COLOR }}
                  />
                </div>
                <span className="sr-only">{isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
              </button>

              <div className="text-center flex-1">
                <div className="mb-4">
                  <div className="text-5xl font-bold" style={{ color: PRIMARY_COLOR }}>
                    {HASHTAG}
                  </div>
                  <div className="h-1 my-3 max-w-2xl mx-auto" style={{ backgroundColor: SECONDARY_COLOR }}></div>
                  <div className="text-4xl font-bold" style={{ color: SECONDARY_COLOR }}>
                    {String(CITY_NAME).toUpperCase()}<br/>{CITY_TAGLINE}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeMenu}
          >
            <nav
              id="mainNav"
              role="navigation"
              aria-labelledby="navTitle"
              className="absolute left-1/2 top-6 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span id="navTitle" className="text-lg font-semibold text-slate-800">Navigation {MOVEMENT_NAME}</span>
                <button
                  type="button"
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  onClick={closeMenu}
                  aria-label="Fermer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-3 text-left text-sm font-semibold text-slate-700">
                <li>
                  <Link to="/" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Consultation citoyenne
                  </Link>
                </li>
                <li>
                  <Link to="/kudocracy" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Propositions Kudocracy
                  </Link>
                </li>
                <li>
                  <Link to="/wiki" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Wiki collaboratif
                  </Link>
                </li>
                <li>
                  <Link to="/bob" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    IA Pertitellu
                  </Link>
                </li>
                <li>
                  <Link to="/transparence" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Transparence nationale
                  </Link>
                </li>
                <li>
                  <Link to="/methodologie" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Méthodologie
                  </Link>
                </li>
                <li>
                  <Link to="/audit" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    Audit éthique
                  </Link>
                </li>
                <li>
                  <Link to="/survey" onClick={closeMenu} className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100">
                    À propos / Survey
                  </Link>
                </li>
              </ul>
              <div className="mt-6 text-xs text-slate-500">
                {PARTY_NAME} — {MOVEMENT_NAME} {CITY_NAME} © {new Date().getFullYear()}
              </div>
            </nav>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 py-8">
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-green-800 mb-2">Merci pour votre participation !</h2>
              <p className="text-green-700">Votre réponse a été enregistrée. Redirection vers les résultats...</p>
            </div>
          ) : (
            <>
            <div className="rounded-lg shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => setIsFormOpen((open) => !open)}
                className="flex w-full items-center justify-between bg-slate-100 px-6 py-4 text-left text-lg font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                <span>Questionnaire citoyen {MOVEMENT_NAME}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform ${isFormOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFormOpen && isCorte && (
                <div id="mainContent" className="bg-white p-8">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">Consultation {getCommunityLabels().citizens} sur la démocratie locale</h1>
              <p className="text-gray-600 mb-6">Une initiative {MOVEMENT_NAME} pour la {getCommunityLabels().name} de {COMMUNITY_NAME}</p>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="space-y-8">
                    {/* Modules de questionnaire dynamiques basés sur le type de communauté */}
                    <div className="mb-8">
                      <h2 className="text-xl font-bold text-gray-800 mb-4">{modules.title}</h2>
                      {modules.modules.map((module) => (
                        <div key={module.id} className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">{module.title}</h3>
                          {module.questions.map((q) => (
                            <div key={q.id} className="mb-4">
                              <label className="block text-gray-700 font-medium mb-2">
                                {q.label}
                              </label>
                              {/* Radios */}
                              {q.type === 'radio' && (
                                <div className="space-y-2">
                                  {q.options.map((opt) => (
                                    <label key={opt} className="flex items-center cursor-pointer">
                                      <input
                                        type="radio"
                                        name={q.id}
                                        value={opt}
                                        checked={formData[q.id] === opt}
                                        onChange={handleInputChange}
                                        className="mr-2"
                                      />
                                      {opt}
                                    </label>
                                  ))}
                                </div>
                              )}
                              {/* Échelle 1-5 */}
                              {q.type === 'scale' && (
                                <div>
                                  {/* Version mobile */}
                                  <div className="md:hidden">
                                    <select
                                      name={q.id}
                                      value={formData[q.id] ?? 3}
                                      onChange={handleInputChange}
                                      className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                    >
                                      <option value="1">{q.labels?.[0] || '1'}</option>
                                      <option value="2">{q.labels?.[1] || '2'}</option>
                                      <option value="3">{q.labels?.[2] || '3'}</option>
                                      <option value="4">{q.labels?.[3] || '4'}</option>
                                      <option value="5">{q.labels?.[4] || '5'}</option>
                                    </select>
                                  </div>
                                  {/* Version desktop */}
                                  <div className="hidden md:flex items-center space-x-4">
                                    <span className="text-sm text-gray-600">{q.labels?.[0] || '1'}</span>
                                    {[1,2,3,4,5].map(num => (
                                      <label key={num} className="flex items-center cursor-pointer">
                                        <input
                                          type="radio"
                                          name={q.id}
                                          value={num}
                                          checked={Number(formData[q.id] ?? 3) === num}
                                          onChange={handleInputChange}
                                          className="mr-1"
                                        />
                                        {num}
                                      </label>
                                    ))}
                                    <span className="text-sm text-gray-600">{q.labels?.[4] || '5'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="pl-4" style={{ borderLeft: `4px solid ${PRIMARY_COLOR}` }}>
                      <h2 className="text-xl font-bold text-gray-800 mb-4">L'affaire de Quasquara</h2>
                      
                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Connaissez-vous la polémique sur la croix de Quasquara ?
                        </label>
                        <div className="space-y-2">
                          {['Oui', 'Non'].map(option => (
                            <label key={option} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="connaissanceQuasquara"
                                value={option}
                                checked={formData.connaissanceQuasquara === option}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Quelle est votre position sur cette affaire ?
                        </label>
                        <div className="space-y-2">
                          {[
                            {label: 'Maintien de la croix', value: 'Maintien'},
                            {label: 'Retrait de la croix', value: 'Retrait'},
                            {label: 'Sans avis', value: 'Sans'},
                            {label: 'Je préfère ne pas répondre', value: 'NoAnswer'}
                          ].map(option => (
                            <label key={option.value} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="positionQuasquara"
                                value={option.value}
                                checked={formData.positionQuasquara === option.value}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Qui devrait décider dans ce type de situation ?
                        </label>
                        <div className="space-y-2">
                          {['Justice', 'Élus locaux', 'Référendum des habitants', 'Autre'].map(option => (
                            <label key={option} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="quiDecide"
                                value={option}
                                checked={formData.quiDecide === option}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pl-4" style={{ borderLeft: `4px solid ${SECONDARY_COLOR}` }}>
                      <h2 className="text-xl font-bold text-gray-800 mb-4">Démocratie {getCommunityLabels().name}</h2>
                      
                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Êtes-vous satisfait de la démocratie locale actuelle ?
                        </label>
                        {/* Version mobile des notes */}
                        <div className="md:hidden">
                          <select
                            name="satisfactionDemocratie"
                            value={formData.satisfactionDemocratie}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="">Je préfère ne pas répondre</option>
                            <option value="1">1 - Pas du tout satisfait</option>
                            <option value="2">2 - Peu satisfait</option>
                            <option value="3">3 - Moyennement satisfait</option>
                            <option value="4">4 - Satisfait</option>
                            <option value="5">5 - Très satisfait</option>
                          </select>
                        </div>
                        {/* Version desktop des notes */}
                        <div className="hidden md:flex items-center space-x-4">
                          <span className="text-sm text-gray-600">Pas du tout (1)</span>
                          {[1, 2, 3, 4, 5].map(num => (
                            <label key={num} className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="satisfactionDemocratie"
                                value={num}
                                checked={Number(formData.satisfactionDemocratie) === num}
                                onChange={handleInputChange}
                                className="mr-1"
                            />
                            {num}
                            </label>
                          ))}
                          <span className="text-sm text-gray-600">Très satisfait (5)</span>
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Pensez-vous que {CITY_NAME} est en déclin ?
                        </label>
                        <div className="md:hidden">
                          <select
                            name="declinVille"
                            value={formData.declinVille}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md"
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
                          <span className="text-sm text-gray-600">En développement (1)</span>
                          {[1, 2, 3, 4, 5].map(num => (
                            <label key={num} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="declinVille"
                                value={num}
                                checked={Number(formData.declinVille) === num}
                                onChange={handleInputChange}
                                className="mr-1"
                              />
                              {num}
                            </label>
                          ))}
                          <span className="text-sm text-gray-600">En déclin (5)</span>
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Seriez-vous favorable à des référendums locaux sur des questions importantes ?
                        </label>
                        <div className="space-y-2">
                          {[
                            {label: 'Oui', value: 'Oui'},
                            {label: 'Non', value: 'Non'},
                            {label: 'Selon les sujets', value: 'Selon'}
                          ].map(option => (
                            <label key={option.value} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="favorableReferendum"
                                value={option.value}
                                checked={formData.favorableReferendum === option.value}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Sur quels sujets ces référendums devraient-ils porter ? (choix multiples)
                        </label>
                        <div className="space-y-2">
                          {['urbanisme', 'culture', 'budget', 'environnement', 'patrimoine', 'autre'].map(option => (
                            <label key={option} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                name="sujetsReferendum"
                                value={option}
                                checked={formData.sujetsReferendum.includes(option)}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Les horaires actuels des conseils municipaux vous paraissent-ils pratiques ?
                        </label>
                        <div className="space-y-2">
                          {['Oui', 'Non', 'Je ne sais pas', 'Je préfère ne pas répondre'].map(option => (
                            <label key={option} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="horaireConseil"
                                value={option}
                                checked={formData.horaireConseil === option}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pl-4" style={{ borderLeft: `4px solid ${PRIMARY_COLOR}` }}>
                      <h2 className="text-xl font-bold text-gray-800 mb-4">
                        Profil <span className="font-normal text-base text-gray-600">(toutes les questions sont optionnelles)</span>
                      </h2>
                      
                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Êtes-vous inscrit(e) sur les listes électorales à {CITY_NAME} ?
                        </label>
                        <div className="space-y-2">
                          {['Oui', 'Non', 'Pas encore mais je compte le faire', 'Je ne souhaite pas répondre'].map(option => (
                            <label key={option} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="inscritListe"
                                value={option}
                                checked={formData.inscritListe === option}
                                onChange={handleInputChange}
                                className="mr-2"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Quartier de {CITY_NAME}
                        </label>
                        <input
                          type="text"
                          name="quartier"
                          value={formData.quartier}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md"
                          placeholder="Ex: Centre-ville, Citadelle..."
                        />
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Tranche d'âge
                        </label>
                        <select
                          name="age"
                          value={formData.age}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">-- Sélectionnez --</option>
                          <option value="18-25">18-25 ans</option>
                          <option value="26-40">26-40 ans</option>
                          <option value="41-60">41-60 ans</option>
                          <option value="60+">60 ans et plus</option>
                        </select>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Depuis combien de temps habitez-vous {CITY_NAME} ?
                        </label>
                        <select
                          name="dureeHabitation"
                          value={formData.dureeHabitation}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md"
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

                    <div className="pl-4" style={{ borderLeft: `4px solid ${SECONDARY_COLOR}` }}>
                      <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Commentaire libre
                        </label>
                        <textarea
                          name="commentaire"
                          value={formData.commentaire}
                          onChange={handleInputChange}
                          rows="4"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md"
                          placeholder="Vos suggestions, remarques..."
                        />
                      </div>

                      <div className="mb-6 bg-gray-50 p-4 rounded-md">
                        <label className="block text-gray-700 font-semibold mb-2">
                          Souhaitez-vous être tenu informé de nos propositions ?
                        </label>
                        <div className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            name="accepteContact"
                            checked={formData.accepteContact}
                            onChange={handleInputChange}
                            className="mr-2 cursor-pointer"
                          />
                          <span className="text-gray-700">Oui, je souhaite être contacté</span>
                        </div>
                        {formData.accepteContact && (
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md"
                            placeholder="Votre email"
                          />
                        )}
                        
                        <div className="flex items-center mt-4">
                          <input
                            type="checkbox"
                            name="participationEtudeIA"
                            checked={formData.participationEtudeIA}
                            onChange={handleInputChange}
                            className="mr-2 cursor-pointer"
                          />
                          <span className="text-gray-700">
                            Je veux aussi participer à l'étude &quot;IA pour tous&quot;
                            <span 
                              className="ml-2 inline-block cursor-pointer text-blue-500 hover:text-blue-700"
                              title="Informations sur l'étude &quot;IA pour tous&quot;"
                              onClick={() => window.open('https://www.ia-pour-tous.fr', '_blank')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full py-3 px-6 text-white font-bold rounded-md text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: PRIMARY_COLOR }}
                    >
                      {loading ? 'Envoi en cours...' : 'Envoyer ma réponse'}
                    </button>
                  </div>

                  <div className="mt-8 text-center">
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleShare}
                        className="px-4 py-2 text-white rounded-md hover:opacity-90 flex items-center gap-2"
                        style={{ backgroundColor: SECONDARY_COLOR }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        Partager
                      </button>
                      <button
                        onClick={() => setPage('results')}
                        className="px-4 py-2 font-semibold rounded-md hover:bg-gray-200 flex items-center gap-2"
                        style={{ backgroundColor: '#f3f4f6', color: SECONDARY_COLOR }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Voir les résultats
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
        <div className="mt-8">
          <SiteFooter />
        </div>
      </div> 
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold" style={{ color: PRIMARY_COLOR }}>
                {HASHTAG}
              </div>
              <div className="h-1 my-3 max-w-2xl mx-auto" style={{ backgroundColor: SECONDARY_COLOR }}></div>
              <div className="text-4xl font-bold" style={{ color: SECONDARY_COLOR }}>
                {String(CITY_NAME).toUpperCase()}<br/>{CITY_TAGLINE}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          {!stats ? (
            <div className="text-center text-gray-600">
              Chargement des résultats...
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">Résultats de la consultation</h1>
                  <p className="text-gray-600">
                    {stats?.totalResponses} participation{stats?.totalResponses > 1 ? 's' : ''} enregistrée{stats?.totalResponses > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={loadResponses}
                  className="px-4 py-2 text-white rounded-md hover:opacity-90"
                  style={{ backgroundColor: SECONDARY_COLOR }}
                >
                  Actualiser
                </button>
              </div>

              <div className="space-y-12">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Connaissance de l'affaire de Quasquara</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.connaissanceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, value}) => `${name}: ${value}`}
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
                </div>

                <div className="px-2 md:px-4">
                  <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 200 : 300}>
                    <BarChart
                      data={stats.positionData}
                      margin={window.innerWidth < 768 ? 
                        { top: 5, right: 10, left: -20, bottom: 5 } :
                        { top: 5, right: 30, left: 20, bottom: 5 }
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#FF5722" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Qui devrait décider ?</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.decisionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#1A4D7C" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Satisfaction de la démocratie locale</h2>
                  <div className="text-center">
                    <div className="text-6xl font-bold" style={{ color: PRIMARY_COLOR }}>
                      {stats.satisfactionMoyenne.toFixed(1)}/5
                    </div>
                    <p className="text-gray-600 mt-2">Note moyenne</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">État de {CITY_NAME}</h2>
                  <div className="text-center">
                    <div className="text-6xl font-bold" style={{ color: PRIMARY_COLOR }}>
                      {stats.declinMoyen.toFixed(1)}/5
                    </div>
                    <p className="text-gray-600 mt-2">1 = En développement, 5 = En déclin</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Favorable aux référendums locaux ?</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.referendumData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, value}) => `${name}: ${value}`}
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
                </div>

                {stats.sujetsData.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Sujets prioritaires pour les référendums</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.sujetsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#FF5722" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Les horaires des conseils municipaux</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats?.horaireConseilData || []} // Vérification que les données existent
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
                </div>
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setPage('form')}
                className="py-3 px-6 text-white font-bold rounded-md hover:opacity-90 transition-opacity"
                style={{ backgroundColor: SECONDARY_COLOR }}
              >
                Participer à la consultation
              </button>
              <button
                onClick={handleShare}
                className="underline hover:opacity-80 flex items-center gap-1"
                style={{ color: SECONDARY_COLOR }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Partager
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}

export function App() {
  const Contact = ({ children, href, ...props }) => {
    if (href) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }
    return (
      <span {...props}>
        {children}
      </span>
    );
  };

  return (
    <Routes>
      <Route path="/" element={<ConsultationPertitellu />} />
      <Route path="/consultation" element={<ConsultationPertitellu />} />
      <Route path="/transparence" element={<Transparence />} />
      <Route path="/methodologie" element={<Methodologie />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/kudocracy" element={<Kudocracy />} />
      <Route path="/propositions/:id" element={<Proposition />} />
      <Route path="/proposition/:id" element={<Proposition />} />
      <Route path="/bob" element={<Bob />} />
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
    </Routes>
  );
}

// Public browser component: browse /docs (served from public/docs)
function PublicBrowser() {
  const baseRoot = '/docs'; // correspond à public/docs
  const [path, setPath] = useState('/');
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const fullPath = useMemo(() => {
    // normalise: /foo/bar -> docs/foo/bar (no leading slash for API)
    const p = path.replace(/^\/*/, '').replace(/\/*$/, '');
    return p ? `${baseRoot}/${p}` : baseRoot;
  }, [path]);

  useEffect(() => {
    async function listDir() {
      setLoading(true);
      setItems(null);
      setViewFile(null);
      setContent('');
      try {
        const apiPath = encodeURIComponent(fullPath.replace(/^\//,''));
        const r = await fetch(`/.netlify/functions/public_browser?path=${apiPath}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        // expected array for directory listing
        if (Array.isArray(json)) {
          setItems(json);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.warn('Listing failed:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    listDir();
  }, [fullPath]);

  async function openEntry(entry) {
    if (entry.isDir || entry.href.endsWith('/')) {
      // compute new relative path (display path only)
      const name = entry.name.replace(/\/$/, '');
      setPath(prev => (prev === '/' ? `/${name}` : `${prev}/${name}`));
      return;
    }

    setLoading(true);
    setViewFile(entry);
    setContent('');
    try {
      const filePath = `${fullPath.replace(/^\//,'')}/${entry.name}`;
      const apiPath = encodeURIComponent(filePath);
      const r = await fetch(`/.netlify/functions/public_browser?path=${apiPath}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j && j.file) {
        if (!j.base64) {
          setContent(j.body);
        } else {
          // base64 binary: check mime to display or offer download link
          if (/^text\/|json|csv|markdown/.test(j.mime)) {
            // base64 text content
            const txt = atob(j.body);
            setContent(txt);
          } else {
            // binary - do not attempt to render, offer download via function
            setContent(`Fichier binaire (${j.mime}). Utilisez le lien "Télécharger".`);
          }
        }
      } else {
        setContent('Contenu indisponible');
      }
    } catch (e) {
      setContent(`Erreur de lecture: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function goUp() {
    if (path === '/' || path === '') return;
    const parts = path.replace(/^\//,'').split('/');
    parts.pop();
    const np = parts.length ? `/${parts.join('/')}` : '/';
    setPath(np);
  }

  function renderFileContent(name, txt) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'md' || ext === 'markdown') {
      const rawHtml = marked.parse(txt || '');
      // Ensure links open in a new tab and add rel for security
      try {
        const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
        doc.querySelectorAll('a').forEach(a => {
          if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
          if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
        });
        const sanitized = DOMPurify.sanitize(doc.body.innerHTML);
        // Use wiki / prose classes to reuse site styling
        return <div className="markdown-content prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      } catch (e) {
        // fallback
        const sanitized = DOMPurify.sanitize(rawHtml);
        return <div className="markdown-content prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      }
    }
    if (ext === 'json') {
      try { return <pre>{JSON.stringify(JSON.parse(txt || '{}'), null, 2)}</pre>; }
      catch { return <pre>{txt}</pre>; }
    }
    if (ext === 'csv') {
      const lines = (txt || '').trim().split(/\r?\n/).filter(Boolean);
      const rows = lines.map(l => l.split(','));
      return (
        <div className="browser-csv">
          <table>
            <thead>
              <tr>{(rows[0]||[]).map((c,i)=>(<th key={i}>{c}</th>))}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r,ri)=>(<tr key={ri}>{r.map((c,ci)=>(<td key={ci}>{c}</td>))}</tr>))}
            </tbody>
          </table>
        </div>
      );
    }
    // txt or fallback
    return <pre style={{whiteSpace:'pre-wrap'}}>{txt}</pre>;
  }

  // helper to build download URL via function
  function fileDownloadUrl(entry) {
    const filePath = `${fullPath.replace(/^\//,'')}/${entry.name}`;
    return `/.netlify/functions/public_browser?path=${encodeURIComponent(filePath)}&download=1`;
  }

  return (
    <div className="public-browser">
      <div className="browser-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <h2>Explorateur public (docs)</h2>
        <div>
          <button
            onClick={() => { setPath('/'); }}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 mr-2"
            aria-label="Aller à la racine"
          >
            Racine
          </button>
          <button
            onClick={goUp}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Remonter d'un niveau"
          >
            Remonter
          </button>
        </div>
      </div>

      <div className="browser-body" style={{display:'flex',gap:20}}>
        <div
          className="browser-list"
          style={{
            width: 480,                // agrandi pour longs noms
            minWidth: 360,            // responsive minimum
            maxWidth: 560,            // éviter qu'il prenne tout l'écran
            borderRight: '1px solid #eee',
            paddingRight: 12,
            boxSizing: 'border-box'
          }}
         >
          <p><strong>Chemin :</strong> {path}</p>
           {loading && <p>Chargement...</p>}
           {!loading && items && items.length === 0 && <p>Pas de listing disponible pour {fullPath}.</p>}
           {!loading && items && items.length > 0 && (
             <ul style={{listStyle:'none',padding:0}}>
               {items.map((it, i) => {
                 const displayName = it.name || it.href;
                 return (
                  <li key={i} style={{marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                     <button
                       onClick={() => openEntry(it)}
                       className="flex items-center rounded-lg px-3 py-2 hover:bg-slate-100 w-full text-left"
                       style={{ gap: 8 }}
                     >
                       <span className="mr-2">{it.isDir ? '📁' : '📄'}</span>
                       <span
                        style={{
                          display: 'inline-block',
                          wordBreak: 'break-word',    // autorise le retour à la ligne pour longs noms
                          overflowWrap: 'anywhere',
                          whiteSpace: 'normal',
                          lineHeight: 1.2,
                          maxWidth: '100%'
                        }}
                      >
                        {displayName}
                      </span>
                     </button>
                     {!it.isDir && (
                       <a
                         href={ fileDownloadUrl(it) }
                         target="_blank"
                         rel="noreferrer"
                         className="ml-3 inline-flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                         title="Télécharger le fichier"
                       >
                         ⬇
                       </a>
                     )}
                   </li>
                 );
               })}
             </ul>
           )}
         </div>

        <div className="browser-view" style={{flex:1}}>
          {viewFile ? (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3>{viewFile.name}</h3>
                <div>
                  <a
                    href={ fileDownloadUrl(viewFile) }
                    download
                    className="px-3 py-1 rounded-md text-white"
                    style={{ backgroundColor: SECONDARY_COLOR, color: '#fff', textDecoration: 'none' }}
                  >
                    Télécharger
                  </a>
                </div>
              </div>
              {loading ? <p>Chargement du fichier...</p> : renderFileContent(viewFile.name, content)}
            </>
          ) : (
            <p>Sélectionnez un fichier à prévisualiser.</p>
          )}
        </div>
      </div>
    </div>
  );
}
