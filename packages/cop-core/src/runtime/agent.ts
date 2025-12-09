// runtime/agent.ts

import type { COPBus } from "./bus";
import type { COPStore } from "./store";
import type { Event } from "../core";

/** Context passed to agents with minimal utilities. */
export interface AgentContext {
  bus: COPBus;
  store: COPStore;
  now(): string; // ISO date

  /**
   * Convenience helper to publish an event through the bus.
   * The event MUST already respect COP core invariants (topicSeq, schemaVersion, etc.).
   *
   * Implementations of AgentContext are free to enrich this behaviour,
   * but MUST at least ensure that calling emit(event) results in that
   * event being published on the COPBus.
   */
  emit(event: Event): Promise<void>;
}

/** Minimal agent interface. */
export interface COPAgent {
  readonly name: string;

  /**
   * Core reaction to events.
   */
  onEvent(event: Event, ctx: AgentContext): Promise<void>;

  /**
   * Optional periodic supervision / background work.
   */
  onTick?(ctx: AgentContext): Promise<void>;
}
