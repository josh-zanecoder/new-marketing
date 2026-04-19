# Retail Tenant Setup

This folder contains only the retail-specific integration setup for Marketing.

Use this when your tenant is fed by `retail-origination` and you want borrower targeting by referred agent.

## What's here

- `events.md` - minimum Kafka contact metadata contract for retail borrower sync
- `recipient-filters.md` - exact recipient list filters for referred-agent targeting

## Scope

- Keep metadata minimal
- Do not add tenant/source/event noise
- Use `metadata.relationships` as the canonical partner linkage
