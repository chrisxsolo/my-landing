-- Rollback for 20261026000005_school_spot_notes.
-- Guides stop showing "Where to find it" lines; the notes are lost.
drop table if exists public.school_spot_notes;
