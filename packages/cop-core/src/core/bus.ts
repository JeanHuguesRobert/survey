import { Event } from "./types";

/** Abstraction of event bus used by COP core. */
export interface COPBus {
  publish(event: Event): Promise<void>;

  fetchSince(params: {
    topicId: string;
    since?: string;
    limit?: number;
  }): Promise<Event[]>;

  // Optional: subscribe for real-time capable environments
  subscribe?: (
    params: { topicId: string },
    onEvent: (event: Event) => void
  ) => () => void;
}
