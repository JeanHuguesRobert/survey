# **cop-core**

Minimal TypeScript specification of the **Cognitive Orchestration Protocol (COP)** core. This
package defines the **types**, **interfaces**, and **profiles** required to build durable,
event-driven, multi-agent cognitive systems.

The goal of `cop-core` is to provide a **stable, implementation-agnostic foundation** for COP
runtimes (Node, Deno, Bun, Edge, Supabase, browser, workers, etc.).

No logic is implemented here—only **contracts**.

---

## **Contents**

### **Core Types (protocol invariants)**

- `Event`
- `Topic`
- `Job`
- `Step`
- `Artifact`
- Supporting enums: `TopicStatus`, `JobStatus`, `StepStatus`

These types model the immutable event log and durable artifacts of a COP system.

### **Runtime Interfaces**

These are pure contracts that real runtimes implement:

- `COPBus` At-least-once event delivery with:
  - `publish(event)`
  - `fetchSince({ since })`
  - `fetchFromSeq({ fromSeq })` (canonical replay API)
  - optional `subscribe(...)`

- `COPStore` Projection storage for Topics, Jobs, Steps, and Artifacts:
  - `getTopic`, `saveTopic`
  - `getJob`, `saveJob`, `listJobs`, `listJobsByTopic`
  - `getSteps`, `saveStep`
  - `getArtifact`, `saveArtifact`, `listArtifacts`

- `AgentContext`
  - `bus`, `store`, `now()`
  - `emit(event)` → convenience wrapper for `bus.publish`

- `COPAgent`
  - `onEvent(event, ctx)`
  - optional `onTick(ctx)`

- `COPScheduler` (interface only)
  - `start()`, `stop()`
  - `dispatchEvent(event)`
  - optional `getContext()`

### **Profile: Chat**

A specialization for conversational and LLM-driven workflows:

- `ChatEvent`, `ChatEventType`, `ChatEventPayload`
- `ChatMessageArtifact`, `LlmCallArtifact`
- Type-guards (`isChatEvent`, `isChatMessageArtifact`)
- `DeliveryMode`

Profiles are optional; they do **not** affect the COP core.

---

## **Design Principles**

`cop-core` follows six invariants:

1. **Immutability** → Events and Artifacts cannot be modified.
2. **Topic-local ordering** → `topicSeq` provides strict replay order.
3. **Idempotency** → Multiple deliveries MUST NOT corrupt state.
4. **Durability** → All meaningful state lives in Events + Artifacts.
5. **Agent statelessness** → Agents hold no internal mutable state.
6. **Isolation** → Agents communicate only via Events through a bus.

A full description is available in `core/invariants.md`.

---

## **Usage**

This package does not include any execution engine. You must provide concrete implementations of:

- `COPBus`
- `COPStore`
- `COPScheduler`

### Minimal example (pseudo-runtime)

```ts
import { COPCore, COPRuntime } from "cop-core";

const agent: COPRuntime.COPAgent = {
  name: "example",
  async onEvent(event, ctx) {
    console.log("Event received:", event);
  },
  async onTick(ctx) {
    console.log("Tick at", ctx.now());
  },
};

// Example: create your own bus/store/scheduler implementations.
// const bus = ...
// const store = ...
// const scheduler = ...

// scheduler.start();
// scheduler.dispatchEvent({ ... });
```

---

## **What `cop-core` is NOT**

- not a scheduler implementation
- not an event loop
- not an LLM orchestrator
- not tied to any database or provider
- not a runtime library

It is a **specification** meant to last and remain stable across many runtimes.

---

## **What belongs in other packages**

Recommended layout for real usage:

```
cop-core               → Types & interfaces only (this package)
cop-runtime-node       → Node/Deno implementation of bus/store/scheduler
cop-runtime-supabase   → Supabase/Postgres projection store
cop-runtime-edge       → Edge/Workers-compatible runtime
cop-profile-chat       → (optional) extracted chat profile
```

This keeps the core stable and small, while runtimes evolve freely.

---

## **Versioning**

`cop-core` follows semantic, additive versioning:

- **v0.x** → experimental but stable enough to use
- breaking changes → explicit major bump
- new optional fields / interfaces → minor bump only
