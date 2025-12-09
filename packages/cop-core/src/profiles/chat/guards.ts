// profiles/chat/guards.ts

import type { Event as CoreEvent, Artifact as CoreArtifact } from "../../core";
import type {
  ChatEvent,
  ChatMessageArtifact,
} from "./types";

export function isChatEvent(e: CoreEvent): e is ChatEvent {
  return (
    typeof e.type === "string" &&
    [
      "user_message",
      "assistant_reflex",
      "assistant_update",
      "topic_update",
      "job_state_changed",
      "artifact_created",
    ].includes(e.type)
  );
}

export function isChatMessageArtifact(
  a: CoreArtifact
): a is ChatMessageArtifact {
  return a.type === "chat_message";
}
