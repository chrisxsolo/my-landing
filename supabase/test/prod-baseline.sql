-- Production schema baseline for local test DB
-- Generated from production project dmtslzwglpezympptqls via MCP read-only queries
-- DO NOT EDIT — regenerate with: supabase db dump --linked -f supabase/test/prod-baseline.sql
-- This file is gitignored.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Ensure public schema exists with correct grants
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_client_session_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_bay_area_locations_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_professional_portfolio_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- SEQUENCES (for serial / non-identity tables)
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.ai_training_sessions_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.availability_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.bay_area_locations_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.blog_posts_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.grad_outfits_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.grad_photos_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.grad_poses_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.grad_prep_tips_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.image_library_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.inquiries_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.link_clicks_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.link_views_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.links_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.location_spots_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.payments_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.portfolio_categories_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.portfolio_images_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.professional_availability_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id),
  CONSTRAINT admin_users_email_key UNIQUE (email),
  CONSTRAINT admin_users_email_check CHECK (length(trim(email)) > 0)
);

CREATE TABLE IF NOT EXISTS public.ai_training_sessions (
  id bigint NOT NULL DEFAULT nextval('public.ai_training_sessions_id_seq'::regclass),
  created_at timestamptz NOT NULL DEFAULT now(),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  session_label text,
  CONSTRAINT ai_training_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.availability (
  id bigint GENERATED ALWAYS AS IDENTITY,
  date date NOT NULL,
  status text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT availability_pkey PRIMARY KEY (id),
  CONSTRAINT availability_date_key UNIQUE (date)
);

CREATE TABLE IF NOT EXISTS public.bay_area_locations (
  id bigint GENERATED BY DEFAULT AS IDENTITY,
  title text NOT NULL,
  slug text NOT NULL,
  region text NOT NULL,
  city text NOT NULL,
  neighborhood text,
  description text NOT NULL,
  best_for text NOT NULL,
  best_time text NOT NULL,
  tip text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  image_url text,
  "order" integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bay_area_locations_pkey PRIMARY KEY (id),
  CONSTRAINT bay_area_locations_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  body text NOT NULL,
  published_at timestamptz DEFAULT now(),
  slug text NOT NULL,
  cover_image_url text,
  extra_image_urls text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  meta_description text,
  meta_keywords text,
  og_image_url text,
  category text NOT NULL DEFAULT 'journal'::text,
  sites text[] DEFAULT '{}'::text[],
  cover_image_alt text,
  extra_image_alts text[],
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id),
  CONSTRAINT blog_posts_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Chat'::text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_role_check CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id)
);

CREATE TABLE IF NOT EXISTS public.client_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_user_id uuid,
  client_email text NOT NULL,
  client_name text,
  session_type text,
  session_date timestamptz,
  location text,
  meeting_point text,
  current_status text NOT NULL DEFAULT 'inquiry_received'::text,
  estimated_delivery_date date,
  gallery_url text,
  invoice_status text,
  contract_status text,
  backup_status text,
  internal_notes text,
  client_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  google_linked_at timestamptz,
  CONSTRAINT client_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT client_sessions_client_email_check CHECK (length(trim(client_email)) > 0),
  CONSTRAINT client_sessions_current_status_check CHECK (current_status = ANY (ARRAY['inquiry_received'::text, 'booking_in_progress'::text, 'booked'::text, 'session_completed'::text, 'photos_backed_up'::text, 'culling'::text, 'editing'::text, 'final_review'::text, 'delivered'::text])),
  CONSTRAINT client_sessions_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.couples_posing_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt_number integer NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  instructions text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couples_posing_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT couples_posing_prompts_prompt_number_key UNIQUE (prompt_number),
  CONSTRAINT couples_posing_prompts_slug_key UNIQUE (slug),
  CONSTRAINT couples_posing_prompts_title_check CHECK (length(trim(title)) > 0),
  CONSTRAINT couples_posing_prompts_instructions_check CHECK (length(trim(instructions)) > 0),
  CONSTRAINT couples_posing_prompts_prompt_number_check CHECK (prompt_number > 0),
  CONSTRAINT couples_posing_prompts_display_order_check CHECK (display_order >= 0),
  CONSTRAINT couples_posing_prompts_category_check CHECK (category = ANY (ARRAY['Walking and Movement'::text, 'Playful'::text, 'Standing and Intimate'::text, 'From Behind'::text, 'Sitting'::text, 'Piggyback and Lifts'::text]))
);

CREATE TABLE IF NOT EXISTS public.couples_inspiration_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  storage_path text,
  external_source_url text,
  title text NOT NULL,
  internal_notes text,
  client_notes text,
  creator_name text,
  attribution_text text,
  categories text[] NOT NULL DEFAULT '{}'::text[],
  tags text[] NOT NULL DEFAULT '{}'::text[],
  related_prompt_number integer,
  width integer,
  height integer,
  alt_text text,
  visibility text NOT NULL DEFAULT 'private'::text,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  rights_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couples_inspiration_images_pkey PRIMARY KEY (id),
  CONSTRAINT couples_inspiration_images_title_check CHECK (length(trim(title)) > 0),
  CONSTRAINT couples_inspiration_images_display_order_check CHECK (display_order >= 0),
  CONSTRAINT couples_inspiration_images_visibility_check CHECK (visibility = ANY (ARRAY['private'::text, 'client_shareable'::text, 'public'::text])),
  CONSTRAINT couples_inspiration_related_prompt_fkey FOREIGN KEY (related_prompt_number) REFERENCES public.couples_posing_prompts(prompt_number)
);

CREATE TABLE IF NOT EXISTS public.couples_location_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_slug text NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  alt_text text,
  caption text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couples_location_photos_pkey PRIMARY KEY (id),
  CONSTRAINT couples_location_photos_location_slug_check CHECK (length(trim(location_slug)) > 0),
  CONSTRAINT couples_location_photos_image_url_check CHECK (length(trim(image_url)) > 0),
  CONSTRAINT couples_location_photos_sort_order_check CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS public.family_location_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_slug text NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  alt_text text,
  caption text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_location_photos_pkey PRIMARY KEY (id),
  CONSTRAINT family_location_photos_location_slug_check CHECK (length(trim(location_slug)) > 0),
  CONSTRAINT family_location_photos_image_url_check CHECK (length(trim(image_url)) > 0),
  CONSTRAINT family_location_photos_sort_order_check CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS public.gmail_credentials (
  id smallint NOT NULL DEFAULT 1,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gmail_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_credentials_id_check CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.grad_outfits (
  id bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  image_url text NOT NULL,
  tip text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grad_outfits_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grad_photos (
  id bigint GENERATED ALWAYS AS IDENTITY,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grad_photos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grad_poses (
  id bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  image_url text NOT NULL,
  instructions text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grad_poses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grad_prep_tips (
  id bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grad_prep_tips_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.image_library (
  id bigint GENERATED BY DEFAULT AS IDENTITY,
  title text NOT NULL,
  alt text,
  image_url text NOT NULL,
  storage_path text,
  source_type text NOT NULL,
  source_post_id bigint,
  source_post_slug text,
  source_role text NOT NULL,
  in_portfolio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_library_pkey PRIMARY KEY (id),
  CONSTRAINT image_library_title_check CHECK (length(trim(title)) > 0),
  CONSTRAINT image_library_image_url_check CHECK (length(trim(image_url)) > 0),
  CONSTRAINT image_library_source_type_check CHECK (length(trim(source_type)) > 0),
  CONSTRAINT image_library_source_role_check CHECK (length(trim(source_role)) > 0),
  CONSTRAINT image_library_source_dedupe_idx UNIQUE (source_post_id, source_role, image_url),
  CONSTRAINT image_library_source_post_id_fkey FOREIGN KEY (source_post_id) REFERENCES public.blog_posts(id)
);

CREATE TABLE IF NOT EXISTS public.inquiries (
  id bigint NOT NULL DEFAULT nextval('public.inquiries_id_seq'::regclass),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  session_type text,
  date_in_mind text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  payment_status text DEFAULT 'unpaid'::text,
  payment_note text,
  payment_detected_at timestamptz,
  booking_confirmed boolean DEFAULT false,
  session_date date,
  reply_sent_at timestamptz,
  invoice_sent_at timestamptz,
  contract_sent_at timestamptz,
  deposit_paid_at timestamptz,
  gallery_delivered_at timestamptz,
  instagram text,
  school text,
  preferred_time text,
  people text,
  location text,
  confirmation_sent_at timestamptz,
  CONSTRAINT inquiries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.link_clicks (
  id integer NOT NULL DEFAULT nextval('public.link_clicks_id_seq'::regclass),
  link_id integer,
  clicked_at timestamptz DEFAULT now(),
  user_id text,
  referrer text,
  device text,
  CONSTRAINT link_clicks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.link_views (
  id integer NOT NULL DEFAULT nextval('public.link_views_id_seq'::regclass),
  viewed_at timestamptz DEFAULT now(),
  user_id text,
  referrer text,
  device text,
  CONSTRAINT link_views_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.links (
  id bigint GENERATED ALWAYS AS IDENTITY,
  label text NOT NULL,
  url text NOT NULL,
  emoji text,
  description text,
  active boolean DEFAULT true,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT links_pkey PRIMARY KEY (id)
);

-- Add FK after both tables exist
ALTER TABLE public.link_clicks
  ADD CONSTRAINT link_clicks_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id);

CREATE TABLE IF NOT EXISTS public.location_spots (
  id bigint GENERATED ALWAYS AS IDENTITY,
  school_id text NOT NULL,
  school_name text NOT NULL,
  school_short text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  tip text NOT NULL,
  icon text NOT NULL,
  image_url text,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT location_spots_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id bigint GENERATED ALWAYS AS IDENTITY,
  inquiry_id bigint,
  client_name text NOT NULL DEFAULT ''::text,
  client_email text NOT NULL DEFAULT ''::text,
  amount text NOT NULL DEFAULT ''::text,
  method text NOT NULL DEFAULT ''::text,
  payment_type text NOT NULL DEFAULT 'deposit_1'::text,
  invoice text NOT NULL DEFAULT ''::text,
  note text NOT NULL DEFAULT ''::text,
  source text NOT NULL DEFAULT 'pass1'::text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  amount_cents integer NOT NULL DEFAULT 0,
  session_date date,
  status text NOT NULL DEFAULT 'active'::text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_payment_type_check CHECK (payment_type = ANY (ARRAY['deposit_1'::text, 'deposit_2'::text, 'full'::text, 'other'::text])),
  CONSTRAINT payments_source_check CHECK (source = ANY (ARRAY['pass1'::text, 'pass2'::text, 'orphan'::text, 'auto'::text])),
  CONSTRAINT payments_status_check CHECK (status = ANY (ARRAY['active'::text, 'voided'::text, 'refunded'::text])),
  CONSTRAINT payments_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id)
);

CREATE TABLE IF NOT EXISTS public.portfolio_categories (
  id bigint GENERATED BY DEFAULT AS IDENTITY,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT portfolio_categories_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_categories_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.portfolio_images (
  id bigint GENERATED BY DEFAULT AS IDENTITY,
  title text NOT NULL,
  alt text,
  image_url text NOT NULL,
  category_id bigint,
  category_slug text NOT NULL DEFAULT 'portfolio'::text,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  hero_carousel boolean NOT NULL DEFAULT false,
  location text,
  content_hash text,
  CONSTRAINT portfolio_images_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_images_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.portfolio_categories(id)
);

CREATE TABLE IF NOT EXISTS public.professional_availability (
  id bigint GENERATED ALWAYS AS IDENTITY,
  date date NOT NULL,
  status text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT professional_availability_pkey PRIMARY KEY (id),
  CONSTRAINT professional_availability_date_unique UNIQUE (date),
  CONSTRAINT professional_availability_status_check CHECK (status = ANY (ARRAY['available'::text, 'booked'::text, 'hold'::text]))
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT site_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  message text NOT NULL,
  consent_to_marketing boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT '2026-06-06'::text,
  display_name_preference text NOT NULL DEFAULT 'first_name_last_initial'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  source text NOT NULL DEFAULT 'direct_link'::text,
  gallery_id text,
  session_type text,
  admin_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  featured boolean NOT NULL DEFAULT false,
  display_order integer,
  CONSTRAINT testimonials_pkey PRIMARY KEY (id),
  CONSTRAINT testimonials_first_name_check CHECK (char_length(trim(first_name)) >= 1 AND char_length(trim(first_name)) <= 100),
  CONSTRAINT testimonials_last_name_check CHECK (char_length(trim(last_name)) >= 1 AND char_length(trim(last_name)) <= 100),
  CONSTRAINT testimonials_email_check CHECK (email IS NULL OR char_length(email) <= 254),
  CONSTRAINT testimonials_message_check CHECK (char_length(trim(message)) >= 20 AND char_length(trim(message)) <= 2000),
  CONSTRAINT testimonials_consent_check CHECK (consent_to_marketing = true),
  CONSTRAINT testimonials_display_name_pref_check CHECK (display_name_preference = ANY (ARRAY['first_name_last_initial'::text, 'full_name'::text, 'first_name_only'::text])),
  CONSTRAINT testimonials_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'archived'::text])),
  CONSTRAINT testimonials_source_check CHECK (source = ANY (ARRAY['direct_link'::text, 'gallery'::text, 'email'::text, 'manual'::text])),
  CONSTRAINT testimonials_gallery_id_check CHECK (gallery_id IS NULL OR char_length(gallery_id) <= 120),
  CONSTRAINT testimonials_session_type_check CHECK (session_type IS NULL OR char_length(session_type) <= 120),
  CONSTRAINT testimonials_admin_notes_check CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000)
);

CREATE TABLE IF NOT EXISTS public.vault_notes (
  id text NOT NULL,
  title text NOT NULL,
  folder text NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vault_notes_pkey PRIMARY KEY (id)
);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.availability_public AS
  SELECT id,
    date,
    status,
    CASE
      WHEN (status = 'available'::text) THEN note
      ELSE NULL::text
    END AS note
  FROM availability;

-- ============================================================
-- INDEXES (non-primary, non-unique already defined above)
-- ============================================================

CREATE INDEX IF NOT EXISTS admin_users_email_idx ON public.admin_users USING btree (lower(email));
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users USING btree (user_id);

CREATE INDEX IF NOT EXISTS bay_area_locations_region_order_idx ON public.bay_area_locations USING btree (region, "order");

CREATE INDEX IF NOT EXISTS blog_posts_category_published_idx ON public.blog_posts USING btree (category, published_at DESC);

CREATE INDEX IF NOT EXISTS chat_conversations_created_at_idx ON public.chat_conversations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON public.chat_messages USING btree (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS client_sessions_client_email_idx ON public.client_sessions USING btree (lower(client_email));
CREATE INDEX IF NOT EXISTS client_sessions_client_user_id_idx ON public.client_sessions USING btree (client_user_id);
CREATE INDEX IF NOT EXISTS client_sessions_current_status_idx ON public.client_sessions USING btree (current_status);
CREATE INDEX IF NOT EXISTS client_sessions_session_date_idx ON public.client_sessions USING btree (session_date);

CREATE INDEX IF NOT EXISTS couples_inspiration_categories_idx ON public.couples_inspiration_images USING gin (categories);
CREATE INDEX IF NOT EXISTS couples_inspiration_display_order_idx ON public.couples_inspiration_images USING btree (display_order, created_at);
CREATE INDEX IF NOT EXISTS couples_inspiration_tags_idx ON public.couples_inspiration_images USING gin (tags);
CREATE INDEX IF NOT EXISTS couples_inspiration_visibility_idx ON public.couples_inspiration_images USING btree (visibility, is_published, rights_confirmed);

CREATE INDEX IF NOT EXISTS couples_location_photos_location_idx ON public.couples_location_photos USING btree (location_slug, published, featured DESC, sort_order);

CREATE INDEX IF NOT EXISTS couples_posing_prompts_category_idx ON public.couples_posing_prompts USING btree (category, is_published);
CREATE INDEX IF NOT EXISTS couples_posing_prompts_order_idx ON public.couples_posing_prompts USING btree (display_order, prompt_number);

CREATE INDEX IF NOT EXISTS family_location_photos_location_idx ON public.family_location_photos USING btree (location_slug, published, featured DESC, sort_order);

CREATE INDEX IF NOT EXISTS image_library_image_url_idx ON public.image_library USING btree (image_url);
CREATE INDEX IF NOT EXISTS image_library_in_portfolio_idx ON public.image_library USING btree (in_portfolio);
CREATE INDEX IF NOT EXISTS image_library_source_post_id_idx ON public.image_library USING btree (source_post_id);

CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON public.inquiries USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON public.link_clicks USING btree (clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON public.link_clicks USING btree (link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_user_id ON public.link_clicks USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_link_views_user_id ON public.link_views USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_link_views_viewed_at ON public.link_views USING btree (viewed_at);

CREATE INDEX IF NOT EXISTS portfolio_categories_active_order_idx ON public.portfolio_categories USING btree (active, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_images_category_order_idx ON public.portfolio_images USING btree (category_slug, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_images_content_hash_idx ON public.portfolio_images USING btree (content_hash);
CREATE INDEX IF NOT EXISTS portfolio_images_featured_order_idx ON public.portfolio_images USING btree (featured, sort_order);

CREATE INDEX IF NOT EXISTS testimonials_homepage_idx ON public.testimonials USING btree (display_order) WHERE ((status = 'approved'::text) AND (featured = true) AND (published_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS testimonials_source_idx ON public.testimonials USING btree (source);
CREATE INDEX IF NOT EXISTS testimonials_status_idx ON public.testimonials USING btree (status);
CREATE INDEX IF NOT EXISTS testimonials_submitted_at_idx ON public.testimonials USING btree (submitted_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bay_area_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples_inspiration_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples_location_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples_posing_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_location_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Force RLS (blocks even postgres role via client libraries)
ALTER TABLE public.couples_inspiration_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.couples_location_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.couples_posing_prompts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_location_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- admin_users
CREATE POLICY "Admin users can manage admin users"
  ON public.admin_users AS PERMISSIVE FOR ALL TO authenticated
  USING (is_client_session_admin()) WITH CHECK (is_client_session_admin());

CREATE POLICY "Admin users can view themselves"
  ON public.admin_users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

-- bay_area_locations
CREATE POLICY "bay_area_locations_public_read"
  ON public.bay_area_locations AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "bay_area_locations_public_write"
  ON public.bay_area_locations AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

-- client_sessions
CREATE POLICY "Admins can create client sessions"
  ON public.client_sessions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_client_session_admin());

CREATE POLICY "Admins can delete client sessions"
  ON public.client_sessions AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_client_session_admin());

CREATE POLICY "Admins can update client sessions"
  ON public.client_sessions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_client_session_admin()) WITH CHECK (is_client_session_admin());

CREATE POLICY "Admins can view all client sessions"
  ON public.client_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_client_session_admin());

CREATE POLICY "Clients can view their own sessions"
  ON public.client_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((client_user_id = auth.uid()) OR (lower(client_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));

-- couples_location_photos
CREATE POLICY "Public read published couples photos"
  ON public.couples_location_photos AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((published = true));

-- family_location_photos
CREATE POLICY "Public read published family photos"
  ON public.family_location_photos AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((published = true));

-- portfolio_categories
CREATE POLICY "portfolio_categories_public_read"
  ON public.portfolio_categories AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "portfolio_categories_public_write"
  ON public.portfolio_categories AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

-- portfolio_images
CREATE POLICY "portfolio_images_public_read"
  ON public.portfolio_images AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "portfolio_images_public_write"
  ON public.portfolio_images AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

-- professional_availability
CREATE POLICY "public read"
  ON public.professional_availability AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "service write"
  ON public.professional_availability AS PERMISSIVE FOR ALL TO public
  USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER bay_area_locations_set_updated_at
  BEFORE UPDATE ON public.bay_area_locations
  FOR EACH ROW EXECUTE FUNCTION set_bay_area_locations_updated_at();

CREATE TRIGGER client_sessions_set_updated_at
  BEFORE UPDATE ON public.client_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER couples_inspiration_images_set_updated_at
  BEFORE UPDATE ON public.couples_inspiration_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER couples_location_photos_set_updated_at
  BEFORE UPDATE ON public.couples_location_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER couples_posing_prompts_set_updated_at
  BEFORE UPDATE ON public.couples_posing_prompts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER family_location_photos_set_updated_at
  BEFORE UPDATE ON public.family_location_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER image_library_set_updated_at
  BEFORE UPDATE ON public.image_library
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER portfolio_categories_set_updated_at
  BEFORE UPDATE ON public.portfolio_categories
  FOR EACH ROW EXECUTE FUNCTION set_professional_portfolio_updated_at();

CREATE TRIGGER portfolio_images_set_updated_at
  BEFORE UPDATE ON public.portfolio_images
  FOR EACH ROW EXECUTE FUNCTION set_professional_portfolio_updated_at();

CREATE TRIGGER testimonials_set_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
