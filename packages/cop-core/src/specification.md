# 🧠 Cognitive Orchestration Protocol (COP) v0.2: Distributed Agent Specification

This protocol defines the addressing, messaging envelopes, and orchestration layer for distributed
AI agents. It is transport and storage-agnostic.

## 🎯 Scope & Exclusions

- **Defines:** Addressing, **COP_MESSAGE**, **COP_EVENT** envelopes, core invariants, and minimum
  Node/Agent contracts.
- **Excludes:** Storage schemas, discovery protocols (Registry), and transport mechanisms (HTTP,
  Queue, etc.).

---

## 1\. Addressing Model

### 1.1. Address Types

| Type                       | Format                                                    | Semantic Use                                   |
| :------------------------- | :-------------------------------------------------------- | :--------------------------------------------- |
| **COP_ADDR** (Agent)       | `cop://{networkId}/{nodeId}/{instanceId}/{agentName}`     | Targets a specific agent (logical capability). |
| **COPCHAN_ADDR** (Channel) | `copchan://{networkId}/{nodeId}/{instanceId}/{channelId}` | Targets a multicast context (pub/sub).         |

### 1.2. ID Semantics

- **networkId:** Logical domain (e.g., environment).
- **nodeId:** Execution/routing boundary (**CopNode**).
- **instanceId:** Logical tenant/app under a node.
  - _Root Instance Rule:_ $instanceId == nodeId$ denotes the node's root instance.
- **agentName:** Logical capability identifier (NOT a process ID).

### 1.3. Opaqueness Invariant

- All IDs are opaque strings to COP.
- **Routing** MUST rely **only** on exact string matching or simple patterning ($networkId$,
  $nodeId$). No deeper semantics are assumed.

---

## 2\. Network & Node Contract (CopNode)

### 2.1. CopNode Definition

A **CopNode** is a triple boundary: **Routing Boundary**, **Agent Execution Boundary**, and
**Channel Fan-out Boundary**.

### 2.2. CopNode Mandatory Capabilities (MUST)

A **CopNode MUST** be able to:

1.  Accept **COP_MESSAGEs** via `POST /cop`.
2.  Resolve target agents (local or remote) using the `to` address.
3.  Dispatch to local agent runtimes.
4.  Forward messages to other nodes (inter-node routing).
5.  Accept **COP_EVENTs** via `POST /cop/events` and fan-out to channel subscribers.

### 2.3. Statelessness Invariant

- The **CopNode** and its hosted **Agents** are logically **stateless** and **ephemeral**.
- Any durable state (messages, channel subscriptions) **MUST** be stored in external infrastructure.
- Correctness relies **ONLY** on envelopes + storage, not on process longevity.

---

## 3\. Message Envelope (COP_MESSAGE)

Used for **point-to-point** communication (request/response).

### 3.1. Structure

```json
COP_MESSAGE := {
  "cop_version": "0.2",
  "message_id": UUID,
  "correlation_id": UUID | null,
  "from": COP_ADDR,
  "to": COP_ADDR,
  "intent": STRING,
  "payload": OBJECT,
  "channel": COPCHAN_ADDR | null, // Multicast context (Optional)
  "meta": OBJECT | null,
  "auth": OBJECT | null
}
```

### 3.2. Key Field Semantics

| Field              | Description                                                     | Invariant                                                 |
| :----------------- | :-------------------------------------------------------------- | :-------------------------------------------------------- |
| **message_id**     | Globally unique ID for this envelope.                           | **MUST NOT** be reused.                                   |
| **correlation_id** | Links items in the same logical flow (request/response/stream). | **MUST** be preserved across derived responses/streams.   |
| **to**             | Logical target agent address.                                   | **ROUTING IS BASED ON THIS FIELD ONLY.**                  |
| **intent**         | Functional operation identifier (e.g., "llm.generate.stream").  | **MUST NOT** affect routing (agent-level semantics only). |

### 3.3. Message Invariants

1.  **Immutability:** **COP_MESSAGE** is **IMMUTABLE**. Any alteration yields a new $message\_id$.
2.  **Non-Mutation:** Nodes and Agents **MUST NOT** mutate the incoming envelope in-place. New
    envelopes **MUST** be constructed for responses/forwarding.

---

## 4\. Event Envelope (COP_EVENT)

Used for **multicast/fan-out** communication (pub/sub).

### 4.1. Structure

```json
COP_EVENT := {
  "cop_version": "0.2",
  "event_id": UUID,
  "correlation_id": UUID | null,
  "from": COP_ADDR,
  "channel": COPCHAN_ADDR, // REQUIRED
  "event_type": STRING,
  "payload": OBJECT,
  "meta": OBJECT | null
}
```

### 4.2. Event Invariants

1.  **Immutability:** **COP_EVENT** is also **IMMUTABLE**.
2.  **Channel Required:** The $channel$ field **MUST** be present, defining the multicast
    destination.
3.  **Fan-Out Dimension:** Channels are the primary abstraction for multicast/fan-out.

---

## 5\. Agent Contract (COP Interface v0.2)

### 5.1. Input & Output

- **Input:** Exactly one **COP_MESSAGE** (Treated as **READ-ONLY**).
- **Output (Synchronous):** May return a single **COP_MESSAGE** as a direct response.
  - $response.correlation\_id$ **MUST** match the input's $correlation\_id$ (or $message\_id$).
- **Output (Async Job):** May return an immediate ACK: `{ status: "accepted", jobId: STRING }`.
  - Downstream results are emitted as **COP_EVENT** or **COP_MESSAGE** via the node's event
    endpoint, **preserving** the original $correlation\_id$.

### 5.2. Streaming

- Streaming is modeled as a sequence of **COP_EVENTs** (and optional **COP_MESSAGEs**) sharing the
  same $correlation\_id$ and usually the same $channel$.
- Agents emit sequentially; Nodes **SHOULD** preserve order per ($channel$, $correlation\_id$) where
  possible.

---

## 6\. Node Routing & Events

### 6.1. Routing Rules (on `POST /cop`)

- Routing **MUST** be based **SOLELY** on the **`to`** address:
  - If $to.networkId == this.networkId$ **AND** $to.nodeId == this.nodeId$ $\rightarrow$ **Local
    Dispatch**.
  - Otherwise $\rightarrow$ **Inter-Node Forwarding**.
- $intent$ **MUST NOT** be used for routing.

### 6.2. Channel Fan-out (on `POST /cop/events`)

- Identify the $channel$ (COPCHAN_ADDR).
- Fan-out the event to all active subscribers of that channel on this node (clients or agents).

---

## 7\. System Invariants Summary (MUST)

| Invariant         | Entity/Field           | Rule                                                       |
| :---------------- | :--------------------- | :--------------------------------------------------------- |
| **Immutability**  | COP_MESSAGE, COP_EVENT | Any change $\rightarrow$ New ID.                           |
| **Correlation**   | correlation_id         | **MUST** be stable across the same logical flow.           |
| **Statelessness** | Agents, CopNodes       | Runtimes **MUST** tolerate being ephemeral.                |
| **Routing Key**   | `to`                   | Routing decisions **MUST** use `to` **exclusively**.       |
| **Multicast Key** | `channel`              | Channels are the only normative abstraction for multicast. |
| **Versioning**    | All Envelopes          | $cop\_version$ **MUST** be included.                       |
