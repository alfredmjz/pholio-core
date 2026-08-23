# Long-Term Memory: Architectural Decision Records (ADR)

> **Storage Location**: `.context/memories/decisions.md` (Tracked in Repository)  
> **Purpose**: Documents major architectural decisions, subagent voting outcomes, and agreed-upon trade-offs.

---

## ADR-001: Project-Agnostic Agent Workflow & Voting Governance
- **Date**: 2026-08-22
- **Status**: Accepted
- **Context**: Needed a clear, predictable workflow for multi-agent collaboration with explicit task triage and subagent voting on complex features.
- **Decision**:
  1. Standardized a 6-agent hierarchy: `orchestrator`, `system-architect`, `ui-ux-designer`, `senior-engineer`, `code-reviewer`, `ui-flow-reviewer`.
  2. Implemented 3-tier task routing (Low, Medium, High). High-complexity tasks trigger multi-agent voting.
  3. Implemented dual memory management (In-repo long-term vs Gitignored short-term) evaluated per request.
- **Consequences**: Ensures clean execution paths, prevents premature implementation, and preserves long-term project context.
