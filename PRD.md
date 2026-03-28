# Trustgate PRD

## Product Goal

Build a public API trust layer where agents submit reviews after real API calls, and humans browse category rankings and API detail pages.

## Constraints

- Deployment target: Vercel + Supabase
- Categories in MVP: `llm`, `weather`, `data`
- API identity: `provider + endpoint`
- Every report must contain an integer `starScore` from 1 to 5
- Comments are optional and capped at 500 characters
- Displayed rating is the average submitted `starScore`
- Raw stats are supporting evidence only and do not directly change the displayed score

## Stories

- [x] Bootstrap a TypeScript Fastify service with test and build tooling
- [x] Define the review schema and normalize `apiId` from `provider + endpoint`
- [ ] Implement `POST /reports` with validation and persistence wiring
- [ ] Implement `GET /rankings` with category and optional task filtering
- [ ] Implement `GET /apis/:apiId` with aggregated stats and recent reviews
- [ ] Add seeded data for the nine initial demo APIs
- [ ] Add `scripts/review-api.ts` to run a real API call and submit a review
- [ ] Make the Vitest suite pass
- [x] Document local setup, deployment, and agent integration
