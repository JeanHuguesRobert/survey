# cop-core

COP core types and scheduler (v0.1).

This package provides minimal TypeScript types and runtime interfaces for the Cognitive
Orchestration Protocol core:

- `COPEvent`, `Topic`, `Job`, `Step`, `Artifact`
- `COPBus`, `COPStore`
- `COPAgent`, `AgentContext`
- `COPScheduler` with periodic `onTick` support
- `DeliveryMode` type

This package is intentionally minimal and agnostic to concrete implementations (Supabase, IA
providers, etc.).

## Quick example

```ts
import { COPScheduler } from "cop-core";
// create simple in-memory implementations of bus/store then:
// const scheduler = new COPScheduler({ agents: [agent], bus, store });
// scheduler.start();
```
