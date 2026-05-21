-- Seed: guided legacy prompts (Storyworth-style). Safe to re-run via on conflict do nothing.

insert into public.prompt_templates (category, body, suggested_for_relationships, weight) values
  ('childhood', 'What did you eat for breakfast as a kid?', '{parent,grandparent}', 5),
  ('childhood', 'Who was your best friend in elementary school?', '{parent,grandparent}', 4),
  ('childhood', 'What is your earliest memory?', '{parent,grandparent}', 5),
  ('food',      'What was your favorite meal growing up?', '{parent,grandparent}', 5),
  ('food',      'Is there a recipe you want me to remember?', '{parent,grandparent}', 4),
  ('love',      'How did you and Mom/Dad meet?', '{parent,grandparent}', 5),
  ('love',      'What is the most important thing love has taught you?', '{parent,grandparent}', 3),
  ('advice',    'What advice do you want me to have later in life?', '{parent,grandparent}', 5),
  ('advice',    'What did you learn the hard way?', '{parent,grandparent}', 4),
  ('faith',     'What do you believe in most?', '{parent,grandparent}', 2),
  ('holidays',  'What was your favorite holiday growing up?', '{parent,grandparent}', 4),
  ('funny_stories', 'Tell me a story about me when I was little.', '{parent,grandparent}', 5),
  ('lessons',   'What is the hardest lesson you ever learned?', '{parent,grandparent}', 4),
  ('parenting', 'What did you think the first time you held me?', '{parent}', 5),
  ('parenting', 'What do you want me to know about being a parent?', '{parent,grandparent}', 4)
on conflict do nothing;
