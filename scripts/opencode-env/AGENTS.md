# AGENTS.md — Global AI Agent Operating Guide (OpenCode, 2026)

Standing instructions for every OpenCode session. Project-level `AGENTS.md`
files and nested files override/extend this. Keep this file short, specific,
and high-signal: every line must prevent a concrete mistake.

## 1. Core operating principles

- Treat the agent as a fast junior engineer: it proposes, humans decide.
- Draft PRs only; never push directly to `main`/`release`.
- Human-in-the-loop is mandatory for high-risk, irreversible, or externally
  visible actions. Approval fatigue is a smell—reduce volume, not oversight.
- CI is the gate: tests + lint + typecheck + security scan + format on every
  AI-touched change. Extra gates for AI-generated code.
- Assume the model is overconfident and the instruction boundary can be
  bypassed. Contain blast radius with least privilege, not better prompts.
- Prefer boring code: small functions, shallow abstractions, clear names.
  Reject over-abstraction, meta-programming, internal frameworks.

## 2. Context engineering

- Context is finite with diminishing returns: find the smallest high-signal
  token set. Rebuild context each turn instead of blindly appending.
- Just-in-time retrieval: keep lightweight identifiers (paths, queries,
  links) and load data on demand. Progressive disclosure over dumping.
- Scope one feature/problem per session. Long sessions degrade
  instruction-following; start fresh and hand off via `progress.txt` + commits.
- Use compaction for long runs; keep architectural decisions, open bugs,
  implementation details; drop redundant tool outputs.
- Use structured note-taking (`NOTES.md`/`tasks/todo.md`) for cross-session
  state. Memory must be owned by you (files), not a provider.
- Isolate noisy work in subagents; only summaries return to the main agent.
- Never let the same context both write and review (writer/reviewer split).
- Cross-model review catches more: one model writes, another critiques.

## 3. Multi-agent / orchestration

- Thin orchestrator: routing is deterministic (intent, fields, reliability
  gates); domain reasoning lives in isolated specialist subagents.
- One agent = one responsibility; bounded write areas; re-approve on
  changed assumptions.
- Context isolation prevents cross-contamination; failures stay contained.
- Reuse specialists via workflow templates instead of new agents.
- Load knowledge at runtime (files), not build time, so updates take effect
  immediately.
- Draw the deterministic/probabilistic boundary explicitly per component.

## 4. Coding workflow (spec-driven)

1. Spec first: what it does, what it must not touch, acceptance criteria
   (3-6 sentences). No spec = no reliable output.
2. Plan mode before execution; review the plan (<1 min) vs rework (>>).
3. Execute without micromanaging; interrupt only when clearly off track.
4. Review the diff, not just tests. Tests necessary, not sufficient.
5. Iterate: tighten spec, rerun. Three short loops > one long session.
- TDD-first prompting: tests give a binary signal and curb hallucination.
  Write tests → commit → implement → run → iterate.
- Task decomposition: "Extract token validation into a function + tests"
  beats "Refactor auth module".
- Planner/worker/judge for large tasks; parallel workers on a shared task list.
- Commit after each successful sub-task; `git checkout .` is the undo.

## 5. Safety & security (OWASP LLM/Agentic 2026)

- Least agency: avoid unnecessary autonomy; deploy agentic behavior only
  where it adds value.
- Rule of Two: simultaneous (A) untrusted input + (B) sensitive data +
  (C) state change/external comms = per-action human approval.
- Hold credentials and state-change capability in application code, not the
  model; route privileged calls through a deterministic policy engine.
- Least privilege per tool and per operation; preserve user context across
  chained calls; never share tokens across servers.
- Human confirmation for destructive/financial/irreversible actions; show the
  exact rendered action, not a summary.
- Sandboxed execution + egress allowlists; deny non-approved destinations.
- Treat memory writes as privileged: log causing prompt, classify
  instruction-bearing writes, require approval to persist across sessions.
- Strip invisible chars (tag-block, variation selectors, zero-width) at
  ingest/render boundaries.
- Redact PII at the boundary; append-only audit ledger; scoped memory per
  tenant/user.
- Pin, sign, verify MCP/tool packages; audit descriptions for injection;
  monitor composition; block silent updates.
- Defense-in-depth guardrails fail closed; layered (input/output/PII/verify/
  judge). Test against adaptive attackers, not static only.
- Never log secrets/PII; deny reads of `.env`, SSH keys, credentials;
  block dangerous commands (`rm -rf /`, `mkfs`, `curl | bash`).

## 6. MCP & tools

- Design for agent experience, not API completeness: task-oriented tools
  (e.g. `file_support_request`), not CRUD endpoints.
- Keep ≤10-15 tools per server; split by domain; composite over chatty.
- Separate read vs write tools; validate/sanitize all inputs and outputs;
  strict JSON Schema (`additionalProperties: false`, patterns).
- Limit parameters (≤8); provide sensible defaults; deterministic execution.
- Return decision-ready summaries, not raw dumps.
- Human-in-the-loop for sensitive actions; display full params; never
  auto-approve; annotations are hints, not enforcement.
- Sandbox servers; restrict FS/network; separate sensitive from general.
- Pin tool definitions (hash full schema); review descriptions for injection;
  use `mcp-scan`; verify manifests with signed hashes.

## 7. Evaluation & quality

- Evals as CI gate: global pass threshold + zero regressions on core metrics.
- 5-10 cases per known failure mode; prioritize edge/adversarial cases.
- Evaluate trajectories (steps, tool calls, order), not just final output.
- Metrics: goal success rate, step efficiency, tool selection/param accuracy,
  handoff correctness, faithfulness, hallucination, latency p50/p95/p99,
  cost per task, policy violation rate, injection resistance.
- LLM-as-judge with locked rubric/model/version + human calibration (κ≥0.6).
- Offline (golden) + online (sampled 10-20%) eval; promote prod failures to
  golden cases (Export to Dataset).
- Hard gates block release: PII/secret exposure, unauthorized tool exec,
  successful injection/RAG poisoning, tenant-specific high-risk regression.
- Composite score (e.g. 0.4Q+0.3S+0.2E+0.1R) plus hard gates; never approve
  on average alone.

## 8. Observability

- OpenTelemetry GenAI conventions: traces (spans for run/step/model/tool),
  metrics (steps/run, tokens/run, cost/run, tool success rate), logs (JSON at
  boundaries), events (prompts/completions opt-in).
- Replay any run from its trace; alert on steps-per-run and cost-per-run;
  distinguish tool vs run failures; reconstruct from structured logs.
- Dashboards for domain success metrics, model version comparison, cost by
  feature; alert via webhooks/PagerDuty.
- Redact secrets/PII before logging; keep enough payload to reconstruct.
- Track business-critical metrics (task completion, satisfaction), not just
  technical ones.

## 9. Memory & long-term state

- Memory = what you choose to keep, index, refresh, retrieve; long context =
  what you load now.
- Distillation → consolidation → injection; forgetting is essential (prune
  stale/low-confidence/superseded).
- Guardrails at every stage: reject sensitive patterns, instruction-shaped
  payloads; enforce precedence current msg > session > memory; treat memory
  advisory.
- Scope memory per user/tenant/agent; detect cross-session drift.
- Persist as plain files (markdown) you own; survives model/provider switch.

## 10. Cost & performance

- Model routing + fallback; budget tokens; adaptive tool budgeting with
  revocation/throttling.
- Compaction, tool-result clearing, subagents to reduce context; cache
  reusable prompts.
- Validate TCO vs ROI before commit; monitor cost anomalies.
- Kill switches and graceful degradation; stop automated decisions in seconds.

## 11. Git & change management

- Branches `ai/...`; one PR = one feature; squash merge.
- No `on: push` full deploys; use `pull_request`/`workflow_dispatch`.
- Production deploys from `main` only; agent branches → preview/staging.
- Migrations on direct connection; aggregate schema changes.
- Search before generating: reuse existing components/utils/schemas/prompts.
- Cap retries; surface failures; ask human (no infinite loops).
- Event-driven, not polling; scale-to-zero default.

## 12. OpenCode-specific

- Guide files are named `AGENTS.md` (V2 does not fall back to `CLAUDE.md`).
  Global: `~/.config/opencode/AGENTS.md`. Project: `./AGENTS.md` and nested.
  OpenCode loads global first, then upward from workspace to project root;
  outside home only global. Nested files load on exploration (nearest-first).
- Add extra files/globs/URLs via `instructions` in `opencode.jsonc`.
- `AGENTS.md` updates are detected mid-session (ambient instruction update).
- Configure permissions, MCP, skills, commands, plugins in `opencode.jsonc`.
- Use `AGENTS.md` for build commands, architecture, conventions, verification.
- Commit project `AGENTS.md` so everyone gets the same guidance.
- Keep root `AGENTS.md` as router + critical constraints; move long content
  to nested files/docs/skills with "Read when" triggers.
- Target ≤150 lines for `AGENTS.md`, ≤200 soft ceiling; critical rules ≤15.

## 13. Maintenance

- Update the guide the moment an agent repeats a mistake a rule could have
  prevented. A repeated mistake = missing line, not micromanagement.
- Map, don't wish: concrete commands/paths, not platitudes.
- Terse and imperative; remove stale/unused rules; audit for secrets/drift.
- Keep synchronized with README and CI; review on architecture changes.
- Provenance: label AI PRs `ai-generated`; store prompt, tool versions,
  model/provider, permissions, run records; ground-truth receipts (git/disk).
- Track rework-to-delivery ratio per run; stop if revalidating instead of
  shipping.

## 14. Provenance & run records

- Scope binding before execution; prompts overwritten if agent
  self-convince.
- Separate read-only exploration from state-changing actions.
- Dependency changes = distinct approval point.
- Store: initial task, repo/ref, permissions, exceptions, prompt, tool
  versions, model/provider.

## 15. Expert insights (Steinberger, OpenCode team, community)

- Close the loop: agents must compile, lint, execute, and validate their own
  output end-to-end. Local CI over remote CI to avoid 10-min waits.
- Plan long, execute fast: spend time challenging/refining the plan with the
  agent; once satisfied, kick off and move on. Codex for long-running
  backend tasks; Claude for conversational/exploratory work.
- Under-prompt intentionally to discover unexpected solutions; outcomes over
  implementation details.
- "Prompt requests" not pull requests: share prompts + logs, let maintainers
  run with their own context. Architecture discussions replace code review.
- Run 5-10 agents in parallel; stay in flow; sequence tasks that touch same
  code; short sessions (10-60 min).
- Managing teams teaches letting go of perfectionism—applies to agents.
- Most code is boring data transformation; focus energy on system design.
- Playful experimentation beats rigid planning; AI is a skill, not a slur
  ("vibe coding"); reflect on mismatches and adapt.
- Default permissions are permissive: write explicit approval rules before
  first real run; sandbox at OS/container level, not just policy checks.
- MCP servers add context cost: enable one at a time; verify provider/tool
  compatibility for your workflow.
- OpenCode Zen (curated models) is optional; bring your own key or local
  models for sovereignty.
- Self-modifying, self-aware agents (know their source, docs, model) unlock
  advanced workflows—use with care.

## 16. Fluid tool awareness & dynamic discovery (flow over friction)

- Goldilocks altitude: guidance specific enough to steer, flexible enough for
  heuristics. Avoid brittle if-else prompts and vague "do your best" ones.
- Agent awareness as state: keep tools, environment, permissions, task, and
  identity as queryable state refreshed each turn; reason from what you
  actually have, not what you imagine.
- Dynamic discovery pipeline: catalog → eligibility → search → load → model
  selects → authorize → execute → verify. Progressive discovery (meta
  search_tools) loads schemas only when needed; pin common tools. Saves
  ~69% input tokens vs loading all definitions.
- Keep the core prompt small; discover skills/tools on demand; progressive
  disclosure over upfront dumps. Context limits are operational, not just
  cost.
- Separate catalog from model-visible set; enforce authorization at
  execution, not just visibility. Search only already-authorized metadata.
- Design tools for the model: task-oriented, atomic at workflow-step level,
  clear distinct names (namespaced), compact outputs, error messages that
  enable self-correction. Consolidate chained steps into one tool.
- Lean context: offload to files, fresh sessions per phase, budget by
  section, instrument at 70-80% of window. Measure, never guess.
- Harness traits: natural (build on model priors: fs, shell, code),
  transparent (inspectable runs/state), lean/composable, resilient to
  failures and restarts. Determinism in the harness, judgment in the model.
- Flow over friction: suggest and discover rather than hard-block; gate only
  high-risk/irreversible actions; let the model self-correct via tool errors
  and iterative re-search instead of rigid pre-checks.
- Self-awareness unlocks recovery: agent knows its source, docs, model, and
  tools; can inspect and repair its own state. Use with care.
- Awareness state must stay fresh: stale awareness misleads worse than none;
  refresh on capability changes; cache definitions host-side; honor
  list_changed.

---
Sources: OpenAI Practical Guide to Building AI Agents; AWS Prescriptive
Guidance (agentic AI, MCP); Google Cloud production lessons; BCG enterprise
agents; OWASP Top 10 LLM/Agentic 2026 + MCP security; Anthropic context
engineering; Meta thin orchestrator; Microsoft multi-agent patterns; Stack
Overflow maturity model; agentic coding workflow guides (spec/plan/execute/
review/iterate); AGENTS.md open standard; OpenCode V2 docs; Peter Steinberger
(OpenClaw) workflow; Dax Raad / OpenCode team; community repos
(awesome-opencode, expert-mode, swarm, agent-kit, agents-system,
starter-pack, oh-my-opencode-slim); agent awareness & context patterns;
dynamic tool discovery (MCP progressive discovery, MCP-Zero, Nango, Speakeasy);
agent harness design (Adaptive, Agent Engineering, eai toolkit).
EOF