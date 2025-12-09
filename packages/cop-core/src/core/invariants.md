# COP Core Invariants

Version: 0.2 Status: Draft

This document defines the non-optional invariants of the COP Core. Any implementation claiming COP
Core compliance MUST respect these rules.

The COP Core is intentionally model-agnostic, infrastructure-agnostic, and profile-agnostic. It does
not assume LLMs, chat, HTTP, or any specific transport/storage.

---

## 1. Scope

These invariants apply to the following core types:

- `Event`
- `Topic`
- `Job`
- `Step`
- `Artifact`

They do **not** prescribe:

- how these types are stored (SQL, NoSQL, in-memory, etc.),
- how they are transported (HTTP, Kafka, NATS, etc.),
- how they are serialized (JSON, Protobuf, etc.),
- any profile-specific semantics (chat, LLM, analytics, etc.).

Profiles (e.g. “chat”, “RAG”) MAY add additional constraints, but MUST NOT violate the core
invariants.

---

## 2. Terminology

- **MUST / MUST NOT / SHOULD / MAY** are to be interpreted as in RFC 2119.
- **Profile**: a domain-specific specialisation built on top of the core types (e.g. chat, LLM,
  analytics).
- **Projection**: a derived view of state computed from Events and Artifacts (e.g. SQL tables,
  materialized views, caches).

---

## 3. Event invariants

### 3.1. Immutability

- An `Event` is **immutable**.
- Once created, an `Event` MUST NOT be modified or deleted.
- Any change in the system MUST be represented by the creation of one or more new `Event`s.

### 3.2. Topic-local ordering

- For a given `topicId`, all `Event`s MUST form a strictly increasing sequence:
  - `topicSeq` is a monotonically increasing integer: `0, 1, 2, 3, …`.
  - No two Events for the same `topicId` may share the same `topicSeq`.
- Implementations MUST ensure that `topicSeq` provides a **total order** of Events within a Topic,
  independent of wall-clock time.

### 3.3. Replayability

- The state of a given Topic MUST be reconstructible by replaying its Events (in `topicSeq` order),
  combined with Artifacts they reference or produce.
- Any projection of state (e.g. “current jobs”, “current topic status”) MUST be conceptually
  derivable from Events + Artifacts.

### 3.4. Schema versioning

- Each `Event` MUST carry a `schemaVersion` string.
- Implementations MUST NOT assume a single global event schema.
- When reading Events:
  - Unknown fields MUST be ignored.
  - Missing optional fields MUST be handled gracefully.
- Changing the semantics of an existing field in a breaking way MUST result in a new
  `schemaVersion`.

### 3.5. Causality (optional but recommended)

- `correlationId` MAY be used to link Events belonging to a broader logical request or session.
- `parentEventIds` MAY be used to record causal relationships (e.g. this Event was triggered by
  those Events).
- When present, these fields MUST NOT be changed after Event creation.

---

## 4. Artifact invariants

### 4.1. Immutability

- An `Artifact` is **immutable**.
- Once created, an Artifact MUST NOT be modified or deleted.
- To represent an updated value, a new Artifact MUST be created.

### 4.2. Schema versioning

- Each `Artifact` MUST carry a `schemaVersion` string.
- Implementations MUST support reading Artifacts with different `schemaVersion` values over time.
- Unknown fields MUST be ignored, missing optional fields MUST be handled gracefully.

### 4.3. Payload

- `payload` MAY be:
  - a direct value (e.g. text, JSON structure), or
  - an indirect reference (e.g. URL, storage key).
- The core does not constrain payload semantics. Profiles MAY define stricter contracts.

### 4.4. Provenance

- `sourceJobId` and `sourceStepId`, when present, MUST reference existing Job and Step identifiers
  (unless dealing with corrupt or orphaned data; see §9).
- Implementations SHOULD preserve correct provenance when creating Artifacts from Jobs/Steps.

---

## 5. Topic invariants

### 5.1. Status monotonicity

- `Topic.status` MUST be **monotonic**: it MUST NOT revert to a “earlier” status.
- The following progression is RECOMMENDED:

  ```text
  open -> in_progress -> exhausted -> closed
  ```

````

* Implementations MAY define more refined status transitions, but MUST NOT allow cycles or regressions (e.g. `closed -> in_progress` is invalid).

### 5.2. Versioning

* `Topic.currentVersion` MUST be incremented on each meaningful change to the Topic’s state (e.g. status or meta changes).
* `currentVersion` MUST NOT decrease.

---

## 6. Job invariants

### 6.1. Topic reference

* Each `Job.topicId` MUST reference an existing Topic (unless dealing with corrupt or orphaned data; see §9).

### 6.2. Status monotonicity

* `Job.status` MUST be monotonic.

* A typical progression is:

  ```text
  pending -> running -> needs_input -> running -> done | failed | cancelled
  ```

* Reverting from a terminal state (`done`, `failed`, `cancelled`) to a non-terminal state (`pending`, `running`, `needs_input`) is NOT allowed.

### 6.3. Event linkage

* `Job.lastEventAt`, if set, MUST be consistent with the latest relevant Event known for that Job.
* Implementations MAY choose not to maintain `lastEventAt`, but MUST NOT set it to an incorrect value.

---

## 7. Step invariants

### 7.1. Job reference

* Each `Step.jobId` MUST reference an existing Job (unless dealing with corrupt or orphaned data; see §9).

### 7.2. Status monotonicity

* `Step.status` MUST be monotonic.

* A typical progression is:

  ```text
  pending -> running -> done | skipped | failed
  ```

* Reverting from a terminal state (`done`, `skipped`, `failed`) to a non-terminal state (`pending`, `running`) is NOT allowed.

### 7.3. Artifact references

* `inputArtifactIds` and `outputArtifactIds`, when present, MUST reference existing Artifacts (unless dealing with corrupt or orphaned data; see §9).
* Steps MUST NOT embed raw data; they MUST reference Artifacts instead.

---

## 8. Idempotency invariants

### 8.1. Event consumption

* Consumers of Events (agents, projections, workflows) MUST be **idempotent**:

  * Re-processing the same Event one or more times MUST NOT corrupt state or induce inconsistent results.

### 8.2. Job and Step transitions

* Applying the same state transition Event twice MUST NOT lead to invalid or duplicated transitions.
* E.g. receiving a `job_state_changed` Event that moves a Job from `pending` to `running`, twice in a row, MUST result in `status = running` (and not in any inconsistent intermediate state).

### 8.3. Stateless agents

* COP Agents MUST NOT rely on hidden, persistent internal state to behave correctly.
* Any Agent SHOULD be able to recover its correct behaviour after restart by:

  * reading from the Store (Topics, Jobs, Steps, Artifacts),
  * and processing Events.

---

## 9. Durability and projections

### 9.1. Durability

* Events and Artifacts MUST be stored durably.
* System restarts MUST NOT cause loss or corruption of Events or Artifacts that were acknowledged as persisted.

### 9.2. Projections

* The “current state” of Topics, Jobs, Steps, and Artifacts in the Store is a **projection**.
* Projections MUST be conceptually recomputable from Events and Artifacts.
* Implementations MAY:

  * maintain materialized views,
  * use caches,
  * or precomputed indices,
    but MUST treat them as derived, not as sources of truth.

### 9.3. Orphaned / corrupt data

* In the presence of corrupted or partial data (e.g. an Artifact referencing a missing Job), implementations MUST adopt a clearly defined strategy, such as:

  * ignoring orphaned records,
  * flagging them for repair,
  * or exposing them via diagnostic tooling.
* Such inconsistencies MUST NOT break the core invariants for valid data.

---

## 10. Agent and Bus isolation

### 10.1. No direct agent-to-agent calls

* Agents MUST NOT communicate directly with each other (e.g. via in-memory calls or private channels).
* All inter-agent communication MUST occur through Events published to the Bus.

### 10.2. Event-only communication

* Any agent-visible effect MUST be traceable to an Event.
* Agents MUST NOT mutate Topics, Jobs, Steps, or Artifacts directly; they MUST cause changes via Events and subsequent projection updates.

### 10.3. Bus semantics (minimal)

* The Bus MUST deliver Events to subscribers at-least-once.
* Duplicate deliveries MUST be expected and MUST NOT violate idempotency.
* Ordering across Topics is not required; ordering within a Topic MUST be reconstructible via `topicSeq`.

---

## 11. Compatibility over time

### 11.1. Forward compatibility

* Readers MUST tolerate:

  * unknown fields (ignore them),
  * missing optional fields (apply defaults or treat as “unknown”),
  * new `schemaVersion` values, as long as they respect the invariants.

### 11.2. Backward compatibility

* Any change to the core types or invariants that would break existing data MUST increment the overall COP Core version, and be treated as a new major version.
* COP Core v0.2-compliant systems SHOULD continue to read v0.1 data when possible, or provide a migration path.

---

## 12. Profiles

### 12.1. Profile constraints

* A profile MAY add:

  * additional constraints,
  * specialised types,
  * event type enumerations,
  * artifact type schemas.
* A profile MUST NOT violate any COP Core invariants.

### 12.2. Profile identification

* Profiles SHOULD define their own `schemaVersion` namespaces (e.g. `cop.chat.message.v0.2`, `cop.rag.plan.v1.0`).
* Profiles SHOULD document:

  * their event types,
  * their artifact types,
  * their additional status transitions (if any).
````
