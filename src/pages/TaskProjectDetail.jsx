import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getMetadata } from "../lib/metadata";
import { DEFAULT_WORKFLOW_STATES, PROJECT_VIEW_MODES } from "../lib/taskMetadata";
import KanbanBoard from "../components/tasks/KanbanBoard";
import TaskCard from "../components/tasks/TaskCard";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Task Project Detail Page
 *
 * Shows project details with multiple views (Kanban, List, Timeline)
 */
export default function TaskProjectDetail() {
  const { id } = useParams();
  const { currentUser } = useCurrentUser();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(PROJECT_VIEW_MODES.KANBAN);
  const [linkedMission, setLinkedMission] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from("posts")
        .select("*")
        .eq("metadata->>group_id", id)
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      const taskPosts =
        tasksData?.filter((post) => {
          const type = getMetadata(post, "type");
          return type === "task";
        }) || [];

      setTasks(taskPosts);
    } catch (err) {
      console.error("Error loading tasks:", err);
    }
  }, [id]);

  const loadProjectDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load project (group)
      const { data: projectData, error: projectError } = await supabase
        .from("groups")
        .select("*, users:created_by(id, display_name)")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;

      // Verify it's a task project
      const type = getMetadata(projectData, "type");
      if (type !== "task_project") {
        throw new Error("This is not a task project");
      }

      setProject(projectData);

      const missionFromMetadata = projectData?.metadata?.linked_mission || null;
      const missionIdFromMetadata = projectData?.metadata?.linked_mission_id;

      if (missionFromMetadata) {
        setLinkedMission(missionFromMetadata);
      } else if (missionIdFromMetadata) {
        try {
          const { data: missionData, error: missionError } = await supabase
            .from("groups")
            .select("id, name, metadata")
            .eq("id", missionIdFromMetadata)
            .single();

          if (!missionError && missionData) {
            setLinkedMission({
              id: missionData.id,
              name: missionData.name,
              location: missionData.metadata?.mission_details?.location || null,
              status: missionData.metadata?.mission_details?.status || null,
            });
          }
        } catch (missionErr) {
          console.warn("Unable to load linked mission", missionErr);
          setLinkedMission(null);
        }
      } else {
        setLinkedMission(null);
      }

      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*, users(id, display_name, metadata)")
        .eq("group_id", id);

      if (membersError) throw membersError;
      setMembers(membersData || []);

      await loadTasks();
    } catch (err) {
      console.error("Error loading project details:", err);
      setError("Impossible de charger le projet");
    } finally {
      setLoading(false);
    }
  }, [id, loadTasks]);

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 text-center">
          {error || "Projet introuvable"}
        </div>
        <div className="text-center mt-4">
          <Link to="/tasks" className="text-primary-600 hover:underline">
            ← Retour aux projets
          </Link>
        </div>
      </div>
    );
  }

  const projectDetails = getMetadata(project, "project_details", {});
  const workflowStates = projectDetails.workflow_states || DEFAULT_WORKFLOW_STATES;
  const color = projectDetails.color || "#4F46E5";
  const icon = projectDetails.icon || "📋";

  const isMember = currentUser && members.some((m) => m.user_id === currentUser.id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button */}
      <Link to="/tasks" className="text-gray-500 hover:underline mb-4 block">
        ← Retour aux projets
      </Link>

      {/* Project Header */}
      <div
        className="bg-white rounded-lg border-2 shadow-md p-6 mb-6"
        style={{ borderColor: color }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <span className="text-5xl">{icon}</span>
            <div>
              <h1 className="text-3xl font-bold font-bauhaus text-gray-900">{project.name}</h1>
              {project.description && <p className="text-gray-600 mt-2">{project.description}</p>}
              {linkedMission && (
                <div className="flex flex-wrap gap-2 mt-3 text-sm text-gray-700">
                  <Link
                    to={`/missions/${linkedMission.id}`}
                    className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 font-semibold hover:bg-primary-100"
                  >
                    Mission associée · {linkedMission.name}
                  </Link>
                  {linkedMission.status && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                      {linkedMission.status}
                    </span>
                  )}
                  {linkedMission.location && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                      📍 {linkedMission.location}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                <span>
                  {tasks.length} tâche{tasks.length !== 1 ? "s" : ""}
                </span>
                <span>•</span>
                <span>
                  {members.length} membre{members.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Actions d'administration à venir */}
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(PROJECT_VIEW_MODES.KANBAN)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              viewMode === PROJECT_VIEW_MODES.KANBAN
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            📊 Kanban
          </button>
          <button
            onClick={() => setViewMode(PROJECT_VIEW_MODES.LIST)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              viewMode === PROJECT_VIEW_MODES.LIST
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            📋 Liste
          </button>
        </div>

        {isMember && (
          <Link
            to={`/tasks/${id}/task/new`}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Ajouter une tâche
          </Link>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === PROJECT_VIEW_MODES.KANBAN && (
        <KanbanBoard
          tasks={tasks}
          projectId={id}
          workflowStates={workflowStates}
          currentUser={currentUser}
          canEdit={Boolean(isMember)}
          onTaskMove={loadTasks}
        />
      )}

      {viewMode === PROJECT_VIEW_MODES.LIST && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-900">Toutes les tâches</h2>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>Aucune tâche pour le moment</p>
              {isMember && (
                <Link
                  to={`/tasks/${id}/task/new`}
                  className="text-primary-600 hover:underline mt-2 inline-block"
                >
                  Créer la première tâche
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50">
                  <TaskCard task={task} projectId={id} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
