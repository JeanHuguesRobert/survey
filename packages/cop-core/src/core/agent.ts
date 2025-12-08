import { COPBus } from "./bus";
import { COPStore } from "./store";
import { Event } from "./types";

/** Context passed to agents with minimal utilities. */
export interface AgentContext {
  bus: COPBus;
  store: COPStore;
  now(): string; // ISO date
}

/** Minimal agent interface consumable by the COPScheduler. */
export interface COPAgent {
  readonly name: string;
  onEvent(event: Event, ctx: AgentContext): Promise<void>;
  onTick?(ctx: AgentContext): Promise<void>;
}
