import bus from "./cop/supabaseBus.js";
import store from "./cop/supabaseStore.js";
import ophAgent from "./agents/ophéliaAgent.js";

const DEFAULT_POLL_MS = 1000;

export class MCPscheduler {
  constructor({ agents = [ophAgent], pollIntervalMs = DEFAULT_POLL_MS } = {}) {
    this.agents = agents;
    this.pollIntervalMs = pollIntervalMs;
    this.lastSeen = new Date().toISOString();
    this.intervalId = null;
    this.running = false;
  }

  async init() {
    await bus.initBus();
    await store.initStore();
  }

  async processEvents() {
    const events = await bus.fetchSince({ since: this.lastSeen, limit: 500 });
    if (!events || events.length === 0) return;
    for (const e of events) {
      for (const agent of this.agents) {
        try {
          if (agent.onEvent)
            await agent.onEvent(e, { bus, store, now: () => new Date().toISOString() });
        } catch (err) {
          console.error(`Agent ${agent.name || "unnamed"} onEvent error`, err?.message || err);
        }
      }
      this.lastSeen = e.created_at || new Date().toISOString();
    }
  }

  async processTicks() {
    for (const agent of this.agents) {
      if (agent.onTick) {
        try {
          await agent.onTick({ bus, store, now: () => new Date().toISOString() });
        } catch (err) {
          console.error(`Agent ${agent.name || "unnamed"} onTick error`, err?.message || err);
        }
      }
    }

    // Claim and process distributed jobs using store.claimJob if available
    try {
      const workerId = `mcp-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
      let claimed = await store.claimJob({ workerId, leaseSeconds: 60 }).catch(() => null);
      let processed = 0;
      while (claimed && processed < 20) {
        // dispatch to agent that can handle job type
        const jobType = claimed.type;
        const handlers = this.agents.filter(
          (a) => a.onJob && a.jobTypes && a.jobTypes.includes(jobType)
        );
        if (handlers.length === 0) {
          // default: run agents that have onTick for deep processing
          for (const a of this.agents) {
            if (a.onJob) {
              try {
                await a.onJob(claimed, { bus, store, now: () => new Date().toISOString() });
              } catch (e) {
                console.error("agent onJob error", e);
              }
            }
          }
        } else {
          for (const h of handlers) {
            try {
              await h.onJob(claimed, { bus, store, now: () => new Date().toISOString() });
            } catch (e) {
              console.error("agent onJob error", e);
            }
          }
        }
        processed++;
        claimed = await store.claimJob({ workerId, leaseSeconds: 60 }).catch(() => null);
      }
    } catch (err) {
      console.error("Distributed job processing error", err?.message || err);
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.init();
    await this.processEvents();
    await this.processTicks();
    // Add supervision of the scheduler: restart main loop on uncaught errors in the process and attempt a restart
    process.on("unhandledRejection", (reason, p) => {
      console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("Uncaught exception in scheduler process", err);
      try {
        this.stop();
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => this.start(), 3000);
    });

    this.intervalId = setInterval(async () => {
      try {
        await this.processEvents();
        await this.processTicks();
      } catch (err) {
        console.error("Scheduler loop error", err?.message || err);
      }
    }, this.pollIntervalMs);
    console.log("MCP Scheduler started");
  }

  async stop() {
    if (!this.running) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.running = false;
    console.log("MCP Scheduler stopped");
  }
}

export default MCPscheduler;
