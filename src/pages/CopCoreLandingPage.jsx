import React from "react";

const GITHUB_ROOT = "https://github.com/JeanHuguesRobert/survey/tree/main/packages/cop-core";
const GITHUB_BLOB_BASE = "https://github.com/JeanHuguesRobert/survey/blob/main/packages/cop-core";

const link = (path) => `${GITHUB_BLOB_BASE}/${path}`;

export default function CopCoreLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 lg:py-16">
        {/* Hero */}
        <header className="space-y-8 border-b border-slate-800 pb-12">
          <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Cognitive Orchestration Protocol · <span className="ml-1">cop-core</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              COP — Cognitive Orchestration Protocol
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              A minimal, vendor-neutral protocol for durable, replayable and interoperable
              multi-agent AI systems. Stateless agents, immutable events, durable artifacts.
              Runtimes are replaceable. Cognition is not.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={GITHUB_ROOT}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              View on GitHub
              <span className="ml-2 text-xs opacity-80">↗</span>
            </a>
            <a
              href={link("README.md")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-400"
            >
              Read the Overview
            </a>
            <a
              href={link("COMPARISON.md")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-400"
            >
              See how COP compares
            </a>
          </div>
        </header>

        {/* Layout: left (what/why), right (docs) */}
        <main className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* Left column */}
          <div className="space-y-8">
            {/* What is COP */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                What is COP?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                COP (Cognitive Orchestration Protocol) is a{" "}
                <span className="font-semibold">protocol and data model</span>, not a framework. It
                defines the minimal vocabulary needed for durable cognition:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                <li>
                  Core types: <code>Event</code>, <code>Topic</code>, <code>Job</code>,{" "}
                  <code>Step</code>, <code>Artifact</code>
                </li>
                <li>
                  Runtime interfaces: <code>COPBus</code>, <code>COPStore</code>,{" "}
                  <code>COPAgent</code>, <code>AgentContext</code>, <code>COPScheduler</code>
                </li>
                <li>
                  Strict invariants: immutability, idempotency, topic-local ordering, durable state,
                  stateless agents
                </li>
                <li>Profiles for concrete domains: chat/LLM, RAG, tools, workflows</li>
              </ul>
              <p className="mt-3 text-sm text-slate-300">
                COP can be implemented on top of Temporal, Kafka, Supabase, Redis, in-memory
                runtimes, or custom systems. The protocol stays the same; the infrastructure does
                not matter.
              </p>
            </section>

            {/* Why COP vs existing tools */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Why COP instead of “just another agent framework”?
              </h2>
              <p className="mt-3 text-sm text-slate-300">
                Existing tools (LangGraph, Swarm, AutoGen, Semantic Kernel, Temporal, etc.) are
                primarily <span className="font-semibold">frameworks or platforms</span>. They
                provide execution models, SDKs and orchestration engines, but each one:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                <li>defines its own internal event/state model,</li>
                <li>does not interoperate cleanly with others,</li>
                <li>does not standardize durable cognitive history,</li>
                <li>cannot guarantee replayability across frameworks.</li>
              </ul>
              <p className="mt-3 text-sm text-slate-300">
                COP is the missing layer beneath all of them:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                <li>Framework-neutral representation of cognition (events + artifacts)</li>
                <li>Deterministic replay of full reasoning traces, years later</li>
                <li>Stateless agent model with explicit, durable world state</li>
                <li>Interoperability substrate for heterogeneous runtimes and vendors</li>
              </ul>
              <p className="mt-3 text-sm text-slate-300">
                In short: frameworks come and go. COP is designed to remain.
              </p>
            </section>

            {/* Who is this for */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Who should care?
              </h2>
              <div className="mt-3 grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    System architects
                  </h3>
                  <p className="mt-1 text-sm">
                    Designing long-lived multi-agent, LLM-heavy or regulation-sensitive systems that
                    need auditability and reproducibility.
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Framework authors
                  </h3>
                  <p className="mt-1 text-sm">
                    Building orchestration, workflow or agent frameworks that should interoperate
                    instead of locking users in.
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Infra / runtime builders
                  </h3>
                  <p className="mt-1 text-sm">
                    Implementing COPBus/COPStore on top of Kafka, Temporal, Postgres, Redis, or
                    custom transports.
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Institutions &amp; research
                  </h3>
                  <p className="mt-1 text-sm">
                    Needing durable cognitive traces for compliance, safety analysis, governance or
                    scientific reproducibility.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right column: docs & links */}
          <aside className="space-y-6">
            {/* Quick links */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Documentation
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                Start with the overview, then dive into architecture, invariants, comparison and
                roadmap.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <DocLink
                  label="Overview / README"
                  description="High-level description, core concepts, getting started."
                  href={link("README.md")}
                />
                <DocLink
                  label="Architecture"
                  description="How Events, Topics, Jobs, Steps and Artifacts fit together."
                  href={link("Architecture.md")}
                />
                <DocLink
                  label="Invariants"
                  description="Formal invariants: immutability, ordering, durability, idempotency."
                  href={link("invariants.md")}
                />
                <DocLink
                  label="Comparison"
                  description="COP vs LangGraph, Swarm, AutoGen, Semantic Kernel, Temporal, CloudEvents."
                  href={link("COMPARISON.md")}
                />
                <DocLink
                  label="Roadmap"
                  description="Long-term evolution: standardization, federation, cognitive internet layer."
                  href={link("ROADMAP.md")}
                />
                <DocLink
                  label="FAQ"
                  description="Targeted answers for architects, researchers and framework authors."
                  href={link("FAQ.md")}
                />
              </ul>
            </section>

            {/* Core model cheat sheet */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Core model at a glance
              </h2>
              <div className="mt-3 space-y-3 text-xs font-mono text-slate-300">
                <pre className="rounded-xl bg-slate-950/70 p-3">
                  {`Topic
 ├─ Events  (immutable, ordered via topicSeq)
 └─ Artifacts (durable outputs)

Job (within a Topic)
 └─ Steps (phases referencing Artifacts)

Agents
 ├─ react to Events
 └─ emit new Events (stateless logic)

Store & Bus
 ├─ COPStore → projections for Topics, Jobs, Steps, Artifacts
 └─ COPBus   → Event transport + replay (fetchFromSeq)`}
                </pre>
              </div>
            </section>

            {/* Ecosystem / contribution */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Build on COP
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                <li>Implement a COPBus/COPStore for your infrastructure.</li>
                <li>Make your agent framework emit and consume COP Events.</li>
                <li>Define domain-specific profiles (RAG, tools, planning…).</li>
                <li>Use COP as the durable trace for safety and governance layers.</li>
              </ul>
              <a
                href={GITHUB_ROOT}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Open the cop-core repository
                <span className="ml-2 text-[10px] opacity-75">↗</span>
              </a>
            </section>
          </aside>
        </main>

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <p>
            COP (Cognitive Orchestration Protocol) — minimal protocol for durable, distributed
            multi-agent cognition. This page describes the <code>cop-core</code> specification
            package; concrete runtimes live in separate repositories or packages.
          </p>
        </footer>
      </div>
    </div>
  );
}

function DocLink({ label, description, href }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group flex flex-col rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 hover:border-slate-500"
      >
        <span className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-100 group-hover:text-emerald-300">
            {label}
          </span>
          <span className="ml-2 text-[10px] text-slate-500 group-hover:text-emerald-300">↗</span>
        </span>
        <span className="mt-1 text-xs text-slate-400">{description}</span>
      </a>
    </li>
  );
}
