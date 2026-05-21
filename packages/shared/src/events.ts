/**
 * Event-mode domain types + zod schemas.
 *
 * Mirrors packages/db/migrations/20260101000013_events.sql.
 * Event = the time-boxed reunion/vacation surface that sits on top of a family circle.
 * See docs/REUNION-MODE.md for the full plan.
 */

import { z } from 'zod';

// ---- Enums -----------------------------------------------------------------

export const eventKindSchema = z.enum(['reunion', 'vacation', 'holiday', 'gathering', 'other']);
export type EventKind = z.infer<typeof eventKindSchema>;

export const eventStatusSchema = z.enum(['planning', 'upcoming', 'happening', 'past', 'cancelled']);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const rsvpSchema = z.enum(['invited', 'going', 'maybe', 'no']);
export type Rsvp = z.infer<typeof rsvpSchema>;

export const eventPollKindSchema = z.enum(['date', 'location', 'activity', 'custom']);
export type EventPollKind = z.infer<typeof eventPollKindSchema>;

// ---- Inputs (client → API) -------------------------------------------------

export const createEventInputSchema = z
  .object({
    title: z.string().min(1).max(120),
    subtitle: z.string().max(200).optional(),
    kind: eventKindSchema.default('gathering'),
    primary_circle_id: z.string().uuid(),
    /** Extra circles for cross-branch events (Pilks + Smiths at one reunion). */
    additional_circle_ids: z.array(z.string().uuid()).default([]),
    starts_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    ends_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cover_tint: z.string().optional(),
    cover_glyph: z.string().max(8).optional(),
    location_text: z.string().max(200).optional(),
    invite_message: z.string().max(1000).optional(),
  })
  .refine((d) => !d.starts_at || !d.ends_at || d.starts_at <= d.ends_at, {
    message: 'starts_at must be before or equal to ends_at',
    path: ['ends_at'],
  });
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

export const inviteGuestInputSchema = z
  .object({
    event_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    invited_email: z.string().email().optional(),
    invited_phone: z.string().min(7).max(20).optional(),
    display_name: z.string().min(1).max(120),
  })
  .refine((d) => !!(d.user_id || d.invited_email || d.invited_phone), {
    message: 'Provide user_id, email, or phone',
    path: ['user_id'],
  });
export type InviteGuestInput = z.infer<typeof inviteGuestInputSchema>;

export const updateRsvpInputSchema = z.object({
  event_id: z.string().uuid(),
  rsvp: rsvpSchema,
});
export type UpdateRsvpInput = z.infer<typeof updateRsvpInputSchema>;

export const addBringItemInputSchema = z.object({
  event_id: z.string().uuid(),
  item_text: z.string().min(1).max(160),
});
export type AddBringItemInput = z.infer<typeof addBringItemInputSchema>;

export const claimBringItemInputSchema = z.object({
  event_id: z.string().uuid(),
  bring_item_id: z.string().uuid(),
});
export type ClaimBringItemInput = z.infer<typeof claimBringItemInputSchema>;

export const createPollInputSchema = z.object({
  event_id: z.string().uuid(),
  kind: eventPollKindSchema,
  prompt: z.string().min(1).max(200),
  multiple_choice: z.boolean().default(false),
  closes_at: z.string().datetime().optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        subtitle: z.string().max(160).optional(),
        tint: z.string().optional(),
      }),
    )
    .min(2)
    .max(10),
});
export type CreatePollInput = z.infer<typeof createPollInputSchema>;

export const castVoteInputSchema = z.object({
  poll_id: z.string().uuid(),
  option_id: z.string().uuid(),
});
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

export const postEventMediaInputSchema = z.object({
  event_id: z.string().uuid(),
  media_asset_id: z.string().uuid(),
  caption: z.string().max(500).optional(),
});
export type PostEventMediaInput = z.infer<typeof postEventMediaInputSchema>;

// ---- Domain types (DB row shape, loosened) ---------------------------------

export interface EventRecord {
  id: string;
  host_user_id: string;
  primary_circle_id: string;
  title: string;
  subtitle: string | null;
  kind: EventKind;
  starts_at: string | null;
  ends_at: string | null;
  status: EventStatus;
  cover_tint: string | null;
  cover_glyph: string | null;
  location_text: string | null;
  invite_message: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventGuestRecord {
  id: string;
  event_id: string;
  user_id: string | null;
  invited_email: string | null;
  invited_phone: string | null;
  display_name: string;
  rsvp: Rsvp;
  is_host: boolean;
  invited_by_user_id: string | null;
  invited_at: string;
  claimed_at: string | null;
}

export interface EventBringItemRecord {
  id: string;
  event_id: string;
  item_text: string;
  claimed_by_user_id: string | null;
  checked: boolean;
  created_by_user_id: string | null;
  created_at: string;
}

export interface EventPollRecord {
  id: string;
  event_id: string;
  kind: EventPollKind;
  prompt: string;
  multiple_choice: boolean;
  closes_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export interface EventPollOptionRecord {
  id: string;
  poll_id: string;
  label: string;
  subtitle: string | null;
  tint: string | null;
  position: number;
}

export interface EventPollVoteRecord {
  option_id: string;
  voter_user_id: string;
  voted_at: string;
}

export interface EventMediaRecord {
  id: string;
  event_id: string;
  media_asset_id: string;
  caption: string | null;
  posted_by_user_id: string;
  posted_at: string;
  highlight_score: number | null;
}

export interface EventHighlightRecord {
  id: string;
  event_id: string;
  generated_at: string;
  body: {
    media_ids: string[];
    quotes: { author: string; body: string }[];
    polls: { prompt: string; winning_label: string }[];
    chatter: { author: string; body: string }[];
  };
  shared_url: string | null;
}
