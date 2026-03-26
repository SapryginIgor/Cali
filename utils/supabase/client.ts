/**
 * Expo / React Native Supabase client (single shared instance).
 *
 * This project does not use Next.js `@supabase/ssr` (no cookies/middleware).
 * Session persistence and refresh are handled via AsyncStorage in `lib/supabase.ts`
 * and `contexts/AuthContext.tsx`.
 */
export { isSupabaseConfigured, supabase } from "@/lib/supabase";
