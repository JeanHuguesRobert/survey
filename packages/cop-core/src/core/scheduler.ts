import { COPAgent, AgentContext } from "./agent";
import { COPBus } from "./bus";
import { COPStore } from "./store";

export interface SchedulerOptions {
  agents: COPAgent[];
  bus: COPBus;
  store: COPStore;
  pollIntervalMs?: number;
}

export class COPScheduler {
  private readonly agents: COPAgent[];
  private readonly bus: COPBus;
  private readonly store: COPStore;
  private readonly pollIntervalMs: number;
  private intervalId: any | null = null;
  private running = false;

  constructor(options: SchedulerOptions) {
    this.agents = options.agents;
    this.bus = options.bus;
    this.store = options.store;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    const ctx: AgentContext = {
      bus: this.bus,
      store: this.store,
      now: () => new Date().toISOString(),
    };

    const loop = async () => {
      await Promise.allSettled(
        this.agents.map((a) => (a.onTick ? a.onTick(ctx) : Promise.resolve()))
      );
    };

    // start immediately and then interval
    loop().catch(() => {});
    this.intervalId = setInterval(() => {
      loop().catch(() => {});
    }, this.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
