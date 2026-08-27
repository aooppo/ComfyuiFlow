# Implementation Plan: Remote H3 Reference Capability Pack

**Branch**: `codex/018-zero-call-graph-evidence` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

## Summary

Extend the controlled Pack compiler with one server-owned remote H3 reference recipe. Add trusted frozen staging context and safe expansion of selected dynamic runtime node fields so the existing zero-call preflight can validate a complete H3 graph.

## Technical Context

**Language/Version**: TypeScript 5.8 / Node 22  
**Dependencies**: Zod, Vitest, existing ComfyUI bridge  
**Storage**: Existing append-only Pack records; no new tables  
**Testing**: Unit/contract tests plus read-only runtime preflight  
**Constraints**: No `/prompt`, staging upload, provider call, authorization, batch, worker, or AI-QA action.

## Constitution Check

All six principles pass: the graph is server-owned and frozen; the Pack cannot carry provider data or raw graph; the runtime contract is rechecked at zero-call preflight; publication remains `TRIAL` and produces no execution authority.

## Design

1. Extend bounded intent/envelope and Pack parsing only enough to select H3's reviewed profile; reject every other H3 binding.
2. Add H3 compiler recipe with fixed node topology and static output policy. Require a safe one-to-one server-only staged-name context.
3. Retain safe dynamic option metadata from `/object_info` and make validation select nested fields from the graph's declared selector.
4. Add fixtures proving H3 compilation and preflight and update the review UI template.
5. Canonicalize and publish the audited H3 Pack as immutable `TRIAL`; read it back without provider activity.

## Source Areas

```text
packages/project-core/src/{capability-pack,capability-publication,graph-intent,capability-pack-planning-service}.ts
packages/comfyui-bridge/src/{node-catalog,zero-call-graph-validator}.ts
apps/project-web/components/capability-publication-panel.tsx
tests/unit/{capability-pack,graph-intent,capability-pack-planning,zero-call-graph-evidence}.test.ts
specs/020-h3-reference-pack/
```
