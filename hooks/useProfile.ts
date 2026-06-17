import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@/constants/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user) {
        return null;
      }
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) {
        throw error;
      }
      return data as Profile;
    },
    enabled: Boolean(user),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: {
      display_name?: string | null;
      avatar_url?: string | null;
    }) => {
      if (!user) {
        throw new Error("Not signed in");
      }
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return {
    ...query,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
