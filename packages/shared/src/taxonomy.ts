/** Topic tag taxonomy — see §J.2 of docs/SPEC.md. */
export const TOPIC_TAXONOMY = [
  'childhood','food','love','advice','faith','holidays','funny_stories','lessons',
  'travel','music','work','parenting','school','family_traditions','milestones',
  'photos_old','photos_new','recipes',
] as const;

export type TopicSlug = (typeof TOPIC_TAXONOMY)[number];
