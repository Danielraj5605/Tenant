-- Cook & maid page: a phone number for the cook and maid, so any flatmate can call them.
-- Digits with an optional leading +, spaces and dashes allowed; stored as typed.

alter table public.members
  add column phone text
  check (phone is null or phone ~ '^\+?[0-9][0-9 -]{5,18}[0-9]$');
