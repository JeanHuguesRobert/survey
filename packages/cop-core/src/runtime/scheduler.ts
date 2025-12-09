// src/cop/runtime/scheduler.ts

import type { COPAgent, AgentContext } from "./agent";
import type { COPBus } from "./bus";
import type { COPStore } from "./store";
import type { Event } from "../core";

export interface SchedulerOptions {
  agents: COPAgent[];
  bus: COPBus;
  store: COPStore;

  /**
   * Minimal desired interval between two tick cycles, in milliseconds.
   * Implementations MAY choose how strictly they respect this.
   */
  pollIntervalMs?: number;
}

/**
 * COPScheduler is a pure interface describing how a scheduler
 * orchestrates ticks and event dispatch.
 *
 * Implementations MAY:
 * - use setInterval, cron, Temporal.io, etc. for ticks,
 * - poll the bus or use subscribe() for events,
 * but these details stay outside the spec.
 */
export interface COPScheduler {
  /**
   * Start periodic ticks (onTick) for all registered agents.
   */
  start(): void | Promise<void>;

  /**
   * Stop periodic ticks.
   */
  stop(): void | Promise<void>;

  /**
   * Dispatch a single event to all agents' onEvent handlers,
   * using a shared AgentContext.
   *
   * This is meant to be called by whatever component reads from the COPBus
   * (polling, subscribe, etc.).
   */
  dispatchEvent(event: Event): Promise<void>;

  /**
   * Optional: expose the AgentContext used internally by the scheduler,
   * for implementations that need to share it.
   *
   * Implementations MAY choose to return a new context on each call,
   * or a stable shared context.
   */
  getContext?(): AgentContext;
}
