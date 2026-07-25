// Server-side reads for the /grad-guide pages. These tables were previously
// fetched from the browser after hydration (shipping the Supabase client to
// visitors and delaying photos until after JS loaded); now every read runs on
// the server through the shared public-content cache. Admin edits bust the tag
// via /api/admin/revalidate; hourly ISR is the backstop.
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";

export type GradPose = {
  id: number;
  title: string;
  image_url: string;
  instructions: string;
  order: number;
};

export type GradOutfitTip = {
  id: number;
  title: string;
  tip: string;
  icon: string;
  order: number;
};

export type GradPrepTip = {
  id: number;
  title: string;
  description: string;
  icon: string;
  order: number;
};

export type GradPhoto = {
  id: number;
  image_url: string;
  caption: string | null;
};

export type LocationSpot = {
  id: number;
  school_id: string;
  school_name: string;
  school_short: string;
  name: string;
  description: string;
  tip: string;
  icon: string;
  image_url: string | null;
  order: number;
};

// The hub gallery is labeled "Recent grad shoots" — cap it so the page never
// renders an unbounded photo wall as the table grows.
const GRAD_PHOTO_LIMIT = 24;

export const getGradPoses = cachePublicContent(async (): Promise<GradPose[]> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("grad_poses")
      .select("*")
      .order("order", { ascending: true });
    if (error) {
      console.error("Failed to load grad_poses", error);
      return [];
    }
    return (data ?? []) as GradPose[];
  } catch (error) {
    console.error("Failed to load grad_poses", error);
    return [];
  }
}, ["grad-poses"]);

export const getGradOutfitTips = cachePublicContent(async (): Promise<GradOutfitTip[]> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("grad_outfits")
      .select("*")
      .order("order", { ascending: true });
    if (error) {
      console.error("Failed to load grad_outfits", error);
      return [];
    }
    return (data ?? []) as GradOutfitTip[];
  } catch (error) {
    console.error("Failed to load grad_outfits", error);
    return [];
  }
}, ["grad-outfits"]);

export const getGradPrepTips = cachePublicContent(async (): Promise<GradPrepTip[]> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("grad_prep_tips")
      .select("*")
      .order("order", { ascending: true });
    if (error) {
      console.error("Failed to load grad_prep_tips", error);
      return [];
    }
    return (data ?? []) as GradPrepTip[];
  } catch (error) {
    console.error("Failed to load grad_prep_tips", error);
    return [];
  }
}, ["grad-prep-tips"]);

export const getGradPhotos = cachePublicContent(async (): Promise<GradPhoto[]> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("grad_photos")
      .select("id,image_url,caption")
      .order("created_at", { ascending: false })
      .limit(GRAD_PHOTO_LIMIT);
    if (error) {
      console.error("Failed to load grad_photos", error);
      return [];
    }
    return (data ?? []) as GradPhoto[];
  } catch (error) {
    console.error("Failed to load grad_photos", error);
    return [];
  }
}, ["grad-photos"]);

export const getLocationSpots = cachePublicContent(async (): Promise<LocationSpot[]> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("location_spots")
      .select("*")
      .order("school_id")
      .order("order", { ascending: true });
    if (error) {
      console.error("Failed to load location_spots", error);
      return [];
    }
    return (data ?? []) as LocationSpot[];
  } catch (error) {
    console.error("Failed to load location_spots", error);
    return [];
  }
}, ["location-spots"]);
