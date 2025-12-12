// runtime/bus.ts

import type { Event } from "../core";

/**
 * Abstraction of event bus used by COP core.
 *
 * Implementations MAY be backed by Kafka, NATS, Redis Streams,
 * a SQL table, or a simple in-memory queue.
 */
export interface COPBus {
  /**
   * Publish a new event to the bus.
   * The event MUST already respect COP core invariants (topicSeq, schemaVersion, etc.).
   */
  publish(event: Event): Promise<void>;

  /**
   * Fetch events for a topic since a given wall-clock time.
   * Convenience API, not guaranteed to be perfectly aligned with topicSeq.
   */
  fetchSince(params: {
    topicId: string;
    since?: string; // ISO 8601
    limit?: number;
  }): Promise<Event[]>;

  /**
   * Fetch events for a topic starting from a given topicSeq.
   *
   * Semantics:
   * - MUST return all events with event.topicId === topicId
   * - and event.topicSeq >= fromSeq
   * - ordered by topicSeq ascending
   * - up to `limit` events if provided.
   *
   * This is the canonical API for replay / projections.
   */
  fetchFromSeq(params: { topicId: string; fromSeq: number; limit?: number }): Promise<Event[]>;

  /**
   * Optional real-time subscription API.
   * Implementations MAY not support it.
   */
  subscribe?: (params: { topicId: string }, onEvent: (event: Event) => void) => () => void;
}
