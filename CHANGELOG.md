# Changelog

All notable changes to Kin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Reunion Mode v0** (Batch 1B) — Events surface for time-boxed reunions, vacations, holidays, and gatherings, layered on top of the existing family-circle model. Mom is testing this at a July 2026 Pilks reunion.
  - New `events`, `event_circles`, `event_guests`, `event_bring_items`, `event_polls`, `event_poll_options`, `event_poll_votes`, `event_media`, `event_highlights` tables (migration `20260101000013_events.sql`)
  - `family_memberships.is_immediate` and `relationships.is_extended_only` columns to model the inner-ring vs. outer-ring distinction
  - Shared Event/Guest/Poll/BringItem/Media/Highlight types + zod schemas in `@kin/shared`
  - Mobile: `/events` index, upgraded `/moment/[id]` event home, new sub-routes `/moment/[id]/bring`, `/polls`, `/feed`, `/guests`
  - Mobile: `/new/event` flow with kind picker, multi-branch (cross-branch reunions), and extended-guest selection
  - Mobile: upcoming-event hero on Home + immediate vs extended split on the Family tab + new onboarding step `/onboarding/immediate-family`
  - `docs/REUNION-MODE.md` planning doc
- Initial monorepo scaffold (Batch 0)
- Expo + TypeScript + Tamagui mobile app skeleton
- Supabase project structure (config, functions, policies)
- Database migrations covering the v1 schema
- Shared types package
- UI components package (starter)
- Product specification in `docs/SPEC.md`
