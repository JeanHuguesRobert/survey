// src/pages/actes/ActeDetail.jsx
// ============================================================================
// Vue détaillée d'un acte municipal avec historique juridique complet
// ============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSupabase } from "../../contexts/SupabaseContext";
import SiteFooter from "../../components/layout/SiteFooter";

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status, size = "md" }) => {
  const badges = {
    EXECUTOIRE: {
      class: "bg-green-100 text-green-800 border-green-200",
      label: "Exécutoire",
      icon: "✅",
    },
    EN_ATTENTE_CONTROLE: {
      class: "bg-blue-100 text-blue-800 border-blue-200",
      label: "En attente de contrôle",
      icon: "⏳",
    },
    SUSPENDU: {
      class: "bg-orange-100 text-orange-800 border-orange-200",
      label: "Suspendu",
      icon: "⚠️",
    },
    ANNULE: { class: "bg-red-100 text-red-800 border-red-200", label: "Annulé", icon: "❌" },
    NON_TRANSMIS: {
      class: "bg-slate-100 text-slate-800 border-slate-200",
      label: "Non transmis",
      icon: "📤",
    },
    REFUS_IMPLICITE: {
      class: "bg-red-100 text-red-800 border-red-200",
      label: "Refus implicite",
      icon: "🤫",
    },
    RETIRE: { class: "bg-slate-100 text-slate-600 border-slate-200", label: "Retiré", icon: "🗑️" },
  };

  const badge = badges[status] || {
    class: "bg-slate-100 text-slate-600",
    label: status || "N/A",
    icon: "❓",
  };
  const sizeClass = size === "lg" ? "px-4 py-2 text-base" : "px-2 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${badge.class} ${sizeClass}`}
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
};

const InfoRow = ({ label, value, icon }) => (
  <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
    {icon && <span className="text-lg mt-0.5">{icon}</span>}
    <div className="flex-1">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-slate-800 font-medium">{value || "—"}</p>
    </div>
  </div>
);

const DeadlineRow = ({ deadline }) => {
  const isOverdue = deadline.status === "DEPASSEE" || deadline.days_remaining < 0;
  const isUrgent = deadline.days_remaining <= 3 && deadline.days_remaining >= 0;

  return (
    <div
      className={`p-3 rounded border ${isOverdue ? "bg-red-50 border-red-200" : isUrgent ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">
            {deadline.template?.label_fr || deadline.template?.code}
          </p>
          <p className="text-xs text-slate-500">{deadline.due_date}</p>
        </div>
        <span
          className={`font-bold ${isOverdue ? "text-red-600" : isUrgent ? "text-orange-600" : "text-slate-600"}`}
        >
          {isOverdue ? `J+${Math.abs(deadline.days_remaining)}` : `J-${deadline.days_remaining}`}
        </span>
      </div>
      {deadline.consequence_if_missed && (
        <p className="text-xs mt-2 text-slate-600">⚠️ {deadline.consequence_if_missed}</p>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acte, setActe] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    const fetchActeDetails = async () => {
      if (!supabase || !id) {
        setError("Paramètres manquants");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Fetch acte from synthetic view
        const { data: acteData, error: acteError } = await supabase
          .from("v_actes_synthetiques")
          .select("*")
          .eq("id", id)
          .single();

        if (acteError) throw acteError;
        if (!acteData) throw new Error("Acte non trouvé");

        setActe(acteData);

        // 2. Fetch deadlines
        const { data: deadlinesData } = await supabase
          .from("deadline_instance")
          .select("*, template:deadline_template_id(code, label_fr)")
          .eq("entity_type", "ACTE")
          .eq("entity_id", id)
          .order("due_date");

        if (deadlinesData) setDeadlines(deadlinesData);

        // 3. Fetch related demandes
        const { data: demandesData } = await supabase
          .from("demande_admin")
          .select("id, type_demande, reference_interne, objet, date_envoi, status")
          .eq("acte_id", id)
          .order("date_envoi", { ascending: false });

        if (demandesData) setDemandes(demandesData);

        // 4. Fetch linked proofs
        const { data: proofsData } = await supabase
          .from("proof_link")
          .select("*, proof:proof_id(*)")
          .eq("entity_type", "ACTE")
          .eq("entity_id", id);

        if (proofsData) setProofs(proofsData.map((pl) => pl.proof));

        // 5. Fetch legal status history
        const { data: statusData } = await supabase
          .from("legal_status_instance")
          .select("*, registry:status_code(*)")
          .eq("entity_type", "ACTE")
          .eq("entity_id", id)
          .order("date_debut", { ascending: false });

        if (statusData) setStatusHistory(statusData);

        // 6. Fetch version history
        const { data: versionsData } = await supabase
          .from("acte")
          .select("id, version, valid_from, valid_to, objet_court, created_at")
          .or(`id.eq.${id},supersedes_id.eq.${id}`)
          .order("version", { ascending: false });

        if (versionsData) setVersions(versionsData);
      } catch (err) {
        console.error("[ActeDetail] Error:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchActeDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Chargement de l'acte...</p>
        </div>
      </div>
    );
  }

  if (error || !acte) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">⚠️ {error || "Acte non trouvé"}</p>
          <Link to="/actes" className="text-blue-600 hover:text-blue-800">
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link to="/actes" className="hover:text-blue-600">
              Actes
            </Link>
            <span>/</span>
            <span className="text-slate-700">
              {acte.numero_interne || acte.numero_actes || id.slice(0, 8)}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm font-medium">
                  {acte.type_acte || "ACTE"}
                </span>
                <StatusBadge status={acte.statut_juridique} size="lg" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {acte.type_acte} n°{acte.numero_interne || acte.numero_actes || "N/A"}
              </h1>
              <p className="text-slate-600 mt-2 max-w-2xl">
                {acte.objet_complet || acte.objet_court || "Sans objet"}
              </p>
            </div>

            {user && (
              <div className="flex gap-2">
                <Link
                  to={`/actes/${id}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  ✏️ Modifier
                </Link>
                <Link
                  to={`/actes/nouvelle-demande?acte=${id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                >
                  📝 Demande CRPA
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations générales */}
            <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                📋 Informations générales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <InfoRow icon="📅" label="Date de l'acte" value={acte.date_acte} />
                <InfoRow icon="🗓️" label="Date de séance" value={acte.date_seance} />
                <InfoRow icon="🏛️" label="Collectivité" value={acte.collectivite_nom} />
                <InfoRow icon="👥" label="Organe" value={acte.organe} />
                <InfoRow icon="👤" label="Rapporteur" value={acte.rapporteur} />
                <InfoRow icon="📍" label="Code INSEE" value={acte.collectivite_code} />
              </div>
            </section>

            {/* Transmission préfecture */}
            <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                📡 Transmission Préfecture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <InfoRow
                  icon={
                    acte.transmission_confirmed ? "✅" : acte.transmission_declared ? "⏳" : "❌"
                  }
                  label="Statut"
                  value={
                    acte.transmission_confirmed
                      ? `Confirmée le ${acte.transmission_confirmed}`
                      : acte.transmission_declared
                        ? `Déclarée le ${acte.transmission_declared} (non confirmée)`
                        : "Non transmis"
                  }
                />
                <InfoRow icon="🔢" label="Numéro @CTES" value={acte.numero_ctes} />
                <InfoRow icon="📊" label="Statut technique" value={acte.transmission_statut} />
              </div>
            </section>

            {/* Exécution */}
            <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                ⚡ Caractère exécutoire
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <InfoRow
                  icon={acte.exec_declared ? "📝" : "—"}
                  label="Déclaré exécutoire"
                  value={
                    acte.exec_declared ? `Oui (${acte.exec_declared_date || "date N/A"})` : "Non"
                  }
                />
                <InfoRow
                  icon={acte.exec_confirmed ? "✅" : "⏳"}
                  label="Confirmé exécutoire"
                  value={
                    acte.exec_confirmed ? `Oui (${acte.exec_confirmed_date || "date N/A"})` : "Non"
                  }
                />
              </div>
            </section>

            {/* Demandes liées */}
            {demandes.length > 0 && (
              <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  📩 Demandes administratives ({demandes.length})
                </h2>
                <div className="space-y-3">
                  {demandes.map((d) => (
                    <Link
                      key={d.id}
                      to={`/actes/demandes/${d.id}`}
                      className="block p-3 rounded border border-slate-200 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-blue-600">
                            {d.type_demande} — {d.reference_interne || d.id.slice(0, 8)}
                          </span>
                          <p className="text-sm text-slate-600 mt-1 truncate max-w-md">
                            {d.objet || "Sans objet"}
                          </p>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Preuves */}
            {proofs.length > 0 && (
              <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  📎 Preuves et pièces ({proofs.length})
                </h2>
                <div className="space-y-3">
                  {proofs.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded border border-slate-200 flex items-center gap-3"
                    >
                      <span className="text-2xl">
                        {p.type_proof === "PDF"
                          ? "📄"
                          : p.type_proof === "EMAIL"
                            ? "📧"
                            : p.type_proof === "SCREENSHOT"
                              ? "🖼️"
                              : "📎"}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">
                          {p.titre || "Pièce sans titre"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.date_capture} — {p.source_org} — Force: {p.force_probante}
                        </p>
                      </div>
                      <span className={p.verified_by_human ? "text-green-600" : "text-slate-400"}>
                        {p.verified_by_human ? "✅ Vérifié" : "⏳ Non vérifié"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Échéances */}
            <section className="bg-white rounded-lg shadow border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                ⏰ Échéances
              </h2>
              {deadlines.length === 0 ? (
                <p className="text-slate-500 text-sm">Aucune échéance enregistrée.</p>
              ) : (
                <div className="space-y-3">
                  {deadlines.map((d) => (
                    <DeadlineRow key={d.id} deadline={d} />
                  ))}
                </div>
              )}
            </section>

            {/* Historique des statuts */}
            <section className="bg-white rounded-lg shadow border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                📜 Historique juridique
              </h2>
              {statusHistory.length === 0 ? (
                <p className="text-slate-500 text-sm">Aucun historique disponible.</p>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((s, i) => (
                    <div
                      key={s.id}
                      className="relative pl-4 border-l-2 border-slate-200 pb-3 last:pb-0"
                    >
                      <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-300"></div>
                      <p className="font-medium text-sm">
                        <StatusBadge status={s.status_code} />
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {s.date_debut} {s.date_fin ? `→ ${s.date_fin}` : "(en cours)"}
                      </p>
                      {s.justification && (
                        <p className="text-xs text-slate-600 mt-1">{s.justification}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Versions */}
            {versions.length > 1 && (
              <section className="bg-white rounded-lg shadow border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  📚 Versions
                </h2>
                <div className="space-y-2">
                  {versions.map((v) => (
                    <Link
                      key={v.id}
                      to={`/actes/${v.id}`}
                      className={`block p-2 rounded text-sm ${v.id === id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}
                    >
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-slate-500 ml-2">{v.valid_from?.split("T")[0]}</span>
                      {v.valid_to && <span className="text-red-500 ml-2">(obsolète)</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Métadonnées */}
            {acte.metadata && Object.keys(acte.metadata).length > 0 && (
              <section className="bg-white rounded-lg shadow border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  🏷️ Métadonnées
                </h2>
                <div className="text-sm space-y-2">
                  {acte.montant_eur && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Montant</span>
                      <span className="font-medium">
                        {Number(acte.montant_eur).toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  )}
                  {acte.domaine && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Domaine</span>
                      <span className="font-medium">{acte.domaine}</span>
                    </div>
                  )}
                  {acte.votes && (
                    <div>
                      <span className="text-slate-500">Votes</span>
                      <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto">
                        {JSON.stringify(acte.votes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
