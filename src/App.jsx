import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Methodologie from './pages/Methodologie';
import { APP_VERSION, DEPLOY_DATE, GOOGLE_SCRIPT_URL, COLORS } from './constants';
import Audit from './pages/Audit';
import Kudocracy from './pages/Kudocracy';

function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="mb-2">Une initiative #PERTITELLU - Corti Capitale</p>
          <div className="flex justify-center gap-4">
            <Link to="/methodologie" className="text-orange-400 hover:text-orange-300">
              Méthodologie
            </Link>
            <a href="/audit" className="text-orange-400 hover:text-orange-300">
              Audit éthique
            </a>
            Autres services :
            
            <a
              href="https://app.tooljet.ai/applications/133a5d8d-9268-4813-8a46-0126a309b52a"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Incidents
            </a>
            
            <a
              href="https://events-agenda-social.deploypad.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Agenda
            </a>
            
            <Link to="/kudocracy" className="text-orange-400 hover:text-orange-300">
              Propositions
            </Link>
            
            <a
              href="https://www.facebook.com/groups/1269635707349220"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Réseaux Sociaux
            </a>
            
            <a
              href="https://wiki-corte-citoyen-0240441d.base44.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Wiki
            </a>

          </div>
          <div 
            className="text-xs text-gray-500 mt-4 cursor-help"
            title={`Déployé le ${DEPLOY_DATE}`}
          >
            v{APP_VERSION}
          </div>
        </div>
      </footer>
      );
}

export default function ConsultationPertitellu() {
  const [page, setPage] = useState('form');
  const [formData, setFormData] = useState({
    connaissanceQuasquara: '',
    positionQuasquara: '',
    quiDecide: '',
    satisfactionDemocratie: 3,
    declinCorte: 3,
    favorableReferendum: '',
    sujetsReferendum: [],
    inscritListe: '',  // Nouvelle propriété
    quartier: '',
    age: '',
    dureeHabitation: '',
    email: '',
    accepteContact: false,
    commentaire: ''
  });
  
  const [responses, setResponses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          declinCorte: parseInt(row['Déclin Corte']) || 3, // Correction du parsing
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
    if (!formData.connaissanceQuasquara || !formData.positionQuasquara || !formData.quiDecide || !formData.favorableReferendum) {
      alert('Veuillez répondre aux questions obligatoires (sections 1 et 2)');
      return;
    }

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

    const satisfactionMoyenne = responses.reduce((acc, r) => acc + r.satisfactionDemocratie, 0) / responses.length;
    const declinMoyen = responses.reduce((acc, r) => acc + parseInt(r.declinCorte || 3), 0) / responses.length;

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
      satisfactionMoyenne,
      declinMoyen, // Nouvelle stat
      referendumData,
      sujetsData,
      totalResponses: responses.length
    };
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Consultation citoyenne Pertitellu',
      text: 'Participez à la consultation citoyenne sur la démocratie locale à Corte',
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

  const stats = calculateStats();  // Ajout de cette ligne au niveau des autres déclarations d'état

  if (page === 'form') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="text-center">
              <div className="mb-4">
                <div className="text-5xl font-bold" style={{ color: '#FF5722' }}>
                  #PERTITELLU
                </div>
                <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
                <div className="text-4xl font-bold text-blue-900">
                  CORTI<br/>CAPITALE
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-green-800 mb-2">Merci pour votre participation !</h2>
              <p className="text-green-700">Votre réponse a été enregistrée. Redirection vers les résultats...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Consultation citoyenne sur la démocratie locale</h1>
              <p className="text-gray-600 mb-6">Une initiative Pertitellu pour les élections municipales de Corte</p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-8">
                <div className="border-l-4 border-orange-500 pl-4">
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

                <div className="border-l-4 border-blue-900 pl-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Démocratie locale à Corte</h2>
                  
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
                      Pensez-vous que Corte est en déclin ?
                    </label>
                    <div className="md:hidden">
                      <select
                        name="declinCorte"
                        value={formData.declinCorte}
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
                            name="declinCorte"
                            value={num}
                            checked={Number(formData.declinCorte) === num}
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
                </div>

                <div className="border-l-4 border-orange-500 pl-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Profil <span className="font-normal text-base text-gray-600">(toutes les questions sont optionnelles)</span>
                  </h2>
                  
                  <div className="mb-6">
                    <label className="block text-gray-700 font-semibold mb-2">
                      Êtes-vous inscrit(e) sur les listes électorales à Corte ?
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
                      Quartier de Corte
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
                      Depuis combien de temps habitez-vous Corte ?
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

                <div className="border-l-4 border-blue-900 pl-4">
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
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 px-6 text-white font-bold rounded-md text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#FF5722' }}
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer ma réponse'}
                </button>
              </div>

              <div className="mt-8 text-center">
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 bg-blue-900 text-white rounded-md hover:opacity-90 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    Partager
                  </button>
                  <button
                    onClick={() => setPage('results')}
                    className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold rounded-md hover:bg-gray-200 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Voir les résultats
                  </button>
                </div>
              </div>
            </div>
          )
          }
        </div>

        <Footer />
      </div> 
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold" style={{ color: '#FF5722' }}>
                #PERTITELLU
              </div>
              <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
              <div className="text-4xl font-bold text-blue-900">
                CORTI<br/>CAPITALE
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
                  className="px-4 py-2 bg-blue-900 text-white rounded-md hover:opacity-90"
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
                    <div className="text-6xl font-bold" style={{ color: '#FF5722' }}>
                      {stats.satisfactionMoyenne.toFixed(1)}/5
                    </div>
                    <p className="text-gray-600 mt-2">Note moyenne</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">État de Corte</h2>
                  <div className="text-center">
                    <div className="text-6xl font-bold" style={{ color: '#FF5722' }}>
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
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setPage('form')}
                className="py-3 px-6 text-white font-bold rounded-md hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#1A4D7C' }}
              >
                Participer à la consultation
              </button>
              <button
                onClick={handleShare}
                className="text-blue-900 underline hover:text-blue-700 flex items-center gap-1"
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
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ConsultationPertitellu />} />
      <Route path="/methodologie" element={<Methodologie />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/kudocracy" element={<Kudocracy />} />
    </Routes>
  );
}