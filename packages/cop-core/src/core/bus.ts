import { COPEvent } from "./types";

/** Abstraction of event bus used by COP core. */
export interface COPBus {
  publish(event: COPEvent): Promise<void>;

  fetchSince(params: {
    topicId: string;
    since?: string;
    limit?: number;
  }): Promise<COPEvent[]>;

  // Optional: subscribe for real-time capable environments
  subscribe?: (
    params: { topicId: string },
    onEvent: (event: COPEvent) => void
  ) => () => void;
}
