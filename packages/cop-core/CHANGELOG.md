# **CHANGELOG.md**

All notable changes to **cop-core** will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows
**SemVer**, with the reminder that major breaking revisions may still occur before 1.0.

---

## **[0.2.0] – 2025-12-09**

### **Added**

#### **Core model**

- Introduced versioned specification of the COP core (`Event`, `Topic`, `Job`, `Step`, `Artifact`).
- Added `topicSeq` to `Event` to guarantee strict per-topic ordering and replay.
- Added `schemaVersion` to `Event` and `Artifact`.
- Added causal metadata fields: `correlationId`, `parentEventIds`.

#### **Runtime interfaces**

- Added `COPBus` interface with:
  - `publish(event)`
  - `fetchSince({ since })` (time-based convenience API)
  - **`fetchFromSeq({ fromSeq })`** (canonical replay API)
  - `subscribe?`

- Added `COPStore` interface with:
  - Topic operations: `getTopic`, `saveTopic`
  - Job operations: `getJob`, `saveJob`, `listJobs`
  - **`listJobsByTopic`**
  - Step operations: `getSteps`, `saveStep`
  - Artifact operations: `saveArtifact`, `getArtifact`, `listArtifacts`

- Added `AgentContext` interface with:
  - `bus`, `store`, `now()`
  - **`emit(event)` helper**

- Added `COPAgent` interface:
  - Mandatory `onEvent`
  - Optional `onTick`

- Added `COPScheduler` as a **pure interface**, with:
  - `start()`, `stop()`
  - **`dispatchEvent(event)`**
  - optional `getContext()`

- Ensured the entire runtime is **interface-only**, no executable logic in `cop-core`.

#### **Chat profile**

- Added `ChatEvent`, `ChatEventType`, and structured payload types:
  - `UserMessagePayload`
  - `AssistantReflexPayload`
  - `AssistantUpdatePayload`
  - `TopicUpdatePayload`
  - `JobStateChangedPayload`
  - `ArtifactCreatedPayload`

- Added `ChatMessageArtifact` and `LlmCallArtifact`.
- Added `ChatArtifact` union type.
- Added type guards: `isChatEvent`, `isChatMessageArtifact`.
- Added `DeliveryMode` (`sync` | `stream` | `background`) and exported it via the profile index.

#### **Documentation**

- Added `invariants.md` describing the protocol’s invariants:
  - Immutability
  - Topic-local ordering
  - Idempotency
  - Durability
  - Stateless agents
  - Isolation via events

- Rewrote README into a stable specification overview.

---

## **[0.1.0] – 2025-12-05**

### **Initial Release**

- Added minimal experimental core types.
- Added initial scheduler class implementation (removed in 0.2 in favor of interfaces).
- Added first-pass chat profile.

---

## **Unreleased**

### Possible upcoming additions

- Dedicated `InMemoryBus` and `InMemoryStore` reference implementations (in a different package).
- Optional `EventFactory` utilities to standardize construction of COP events.
- Optional supervisor API for hierarchical agent control.
- Extraction of Chat profile into its own package (`cop-profile-chat`).
