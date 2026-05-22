import { Alert } from 'react-native';

type Feature =
  | 'new_moment'
  | 'new_branch'
  | 'invite'
  | 'new_vault'
  | 'photo_book'
  | 'search'
  | 'notifications'
  | 'settings_row'
  | 'send_question'
  | 'record_voice'
  | 'record_video'
  | 'attach_photo'
  | 'skip_prompt'
  | 'today_prompt'
  | 'feed_post'
  | 'see_whole_feed'
  | 'open_vault_item'
  | 'open_memory'
  | 'open_topic'
  | 'message_everyone'
  | 'add_to_packing'
  | 'add_poll_option'
  | 'generate_book'
  | 'profile_tab_questions'
  | 'profile_tab_vault'
  | 'profile_tab_about'
  | 'view_vault_for_me'
  | 'react_or_comment'
  | 'invite_extended'
  | 'extended_member_profile'
  | 'share_highlight_reel'
  | 'upload_photo'
  | 'invite_guest'
  | 'add_poll'
  | 'face_autotag';

const COPY: Record<Feature, { title: string; message: string }> = {
  new_moment: {
    title: 'Plan a new Family Moment',
    message:
      'Opens a form: name the event, set the date window, pick the branch, invite participants. The family then votes on dates, locations, packing list, menu. After the event the whole thing becomes a chapter in the family book.',
  },
  new_branch: {
    title: 'Start another branch',
    message:
      "Branches let you keep separate spaces for divorced parents, in-laws, chosen family, or any group that shouldn't share a feed. Name it, invite who belongs, and you'll be able to switch between branches anytime.",
  },
  invite: {
    title: 'Invite someone',
    message:
      "Pick the relationship, enter a phone or email, send. They get a soft text or email and can join when they're ready. The invite respects the branch you're in.",
  },
  new_vault: {
    title: 'Record something for later',
    message:
      'Record a voice, video, or text message, then choose when it should be released — a date, a birthday, an age milestone, a life event (first child, marriage, graduation), or after your passing with named verifiers. Optionally tie a dollar amount to a milestone — funds held in escrow until release.',
  },
  photo_book: {
    title: 'Photo Book Capture — coming soon',
    message:
      "We're saving this for a later release. The vision: point your phone at each page of a physical photo album, and FamLink extracts every individual photo, OCRs handwritten captions, asks who's in each photo, and adds them to the right timelines. It needs camera wiring and on-device AI before it's ready — but we wanted you to see where this is going. We'll notify you when it ships.",
  },
  search: {
    title: 'Search the family archive',
    message:
      'Find any answer, photo, voice note, or memory. Hybrid search: full-text plus semantic. "What did Mom say about snacks" surfaces the Chicken in a Biskit answer. RLS-filtered — you only see what you\'re allowed to.',
  },
  notifications: {
    title: 'Notifications',
    message:
      'Gentle pushes: new question for you, someone answered your question, vault item about to release, weekly digest of what your family added.',
  },
  settings_row: {
    title: 'In progress',
    message: 'This setting is part of the next round of polish — wiring lands soon.',
  },
  send_question: {
    title: 'Send question',
    message:
      'In the real app this fires a push to the recipient ("Aaron asked you a memory question"), saves the question to your timeline + their inbox, and shows up immediately for them to answer.',
  },
  record_voice: {
    title: 'Voice recording',
    message:
      'Tap-and-hold to record. Live waveform. Tap to stop. Save / re-record / send. Transcribes automatically once sent.',
  },
  record_video: {
    title: 'Video recording',
    message: 'Front- or back-camera, up to 3 minutes. Live preview. Auto-captioned after upload.',
  },
  attach_photo: {
    title: 'Attach a photo',
    message:
      'Pick from your camera roll or take a new one. The photo becomes context for the question or memory.',
  },
  skip_prompt: {
    title: "Skip today's prompt",
    message: 'A new prompt arrives tomorrow. Skipped prompts cycle back later at lower priority.',
  },
  today_prompt: {
    title: "Answer today's prompt",
    message:
      'Opens a focused composer for the daily prompt. Your answer lands in your personal timeline and the relevant topic timeline immediately.',
  },
  feed_post: {
    title: 'Memory detail',
    message:
      'Tapping a memory opens a full-screen view with the original question (if any), the full media, reactions, comments, and the "appears in" timelines.',
  },
  see_whole_feed: {
    title: 'See the whole family feed',
    message: 'Opens an Instagram-style feed of everything in this branch, top to bottom.',
  },
  open_vault_item: {
    title: 'Vault item detail',
    message:
      'Tapping a vault item lets you preview the media, edit the release rule, change recipients, or revoke it. After release, it shows the release event + reactions from recipients.',
  },
  open_memory: {
    title: 'Memory detail',
    message:
      'Full-screen view of the memory: media, transcript, comments, where it lives in your timelines.',
  },
  open_topic: {
    title: 'Topic timeline',
    message:
      'Every memory in your family tagged with this topic — reverse chronological, with AI section headers ("Spring 2026: a flurry of food memories").',
  },
  message_everyone: {
    title: 'Message everyone in this Moment',
    message:
      "Opens a quick-message surface scoped to this Moment's participants. Different from the family feed — focused on the event.",
  },
  add_to_packing: {
    title: 'Add to the packing list',
    message:
      "Type an item, assign someone, set a status. Family members can check things off as they're packed or bought.",
  },
  add_poll_option: {
    title: 'Propose an option',
    message:
      "Add a date window or a location card to this Moment's poll. The family votes; the winner becomes the plan.",
  },
  generate_book: {
    title: 'Generate a book',
    message:
      'FamLink compiles every memory authored by this person — answers, posts, voice notes, photos — into a printable book. AI writes the chapter headings; you review and edit before printing. Hardcover ships in ~10 days.',
  },
  profile_tab_questions: {
    title: 'Questions',
    message:
      "This tab will show questions YOU've asked this person — open and answered. You'll be able to filter by topic and time.",
  },
  profile_tab_vault: {
    title: 'Vault for me',
    message:
      'Anything this person has sealed in the vault for you to receive in the future — birthday messages, milestone gifts, death-triggered letters. Locked until their release rules fire.',
  },
  profile_tab_about: {
    title: 'About',
    message:
      'A page summarizing what you know about this person — their birth date, where they\'re from, key life events, and an AI-generated "what we\'ve learned about them" digest from their answers.',
  },
  view_vault_for_me: {
    title: 'Vault for me',
    message:
      'Shows messages this person has prepared for you to receive in the future. Locked until their release rules fire.',
  },
  react_or_comment: {
    title: 'React or comment',
    message:
      'Tap to add a heart, a voice-note reply, or a text comment. Comments become part of the relationship timeline too.',
  },
  invite_extended: {
    title: 'Add to your family tree',
    message:
      "Pick someone to add to your extended family — aunts, uncles, cousins, in-laws, family friends. Once they're in your tree, you can invite them to any future event without re-typing their info.",
  },
  extended_member_profile: {
    title: 'Family-tree profile',
    message:
      "Extended-family profiles will show how they're related, which events you've shared with them, and any photos or chatter they've been part of.",
  },
  share_highlight_reel: {
    title: 'Share the highlight reel',
    message:
      "Share the event's auto-generated highlight reel as a video — to a guest who missed it, a family chat, or social. Tapping it on a phone that doesn't have FamLink opens a web preview + install prompt.",
  },
  upload_photo: {
    title: 'Share a photo or video',
    message:
      'Pick from camera roll or capture new. Anything you share is scoped to this event and gets auto-considered for the highlight reel.',
  },
  invite_guest: {
    title: 'Invite someone',
    message:
      "Pick from your family tree or invite by phone/email. They get a magic-link push; if they don't have FamLink yet, the link opens a web preview of the event and lets them RSVP. Twilio SMS arrives in Phase 2.",
  },
  add_poll: {
    title: 'New poll',
    message:
      'Pick a poll kind (date, location, activity, custom), write the prompt, add at least two options. Multi-select supported. Closes automatically before the event starts.',
  },
  face_autotag: {
    title: "Auto-tag who's in each photo — coming soon",
    message:
      "As photos and videos roll in during an event, FamLink will detect faces and match them to the people in your family tree — so you don't have to type \"that's Cousin Sara\" 60 times. Saved for a later release: it needs on-device face matching plus a smart backend pipeline, and we want to nail the cost model before turning it on. We'll let you know when it ships.",
  },
};

export function comingSoon(feature: Feature) {
  const { title, message } = COPY[feature];
  Alert.alert(title, message, [{ text: 'Got it', style: 'default' }]);
}
