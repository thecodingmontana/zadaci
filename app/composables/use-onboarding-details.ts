import type { FetchError } from "ofetch";
import type { Workspace } from "~/types";
import { useQuery, useQueryClient } from "@tanstack/vue-query";

export interface OnboardingDetails {
  username: string | null;
  workspace: Workspace | null;
  profile_completed: boolean;
}

export const onboardingDetailsKey = ["user_workspaces"] as const;

export function useOnboardingDetails() {
  const requestFetch = useRequestFetch();

  return useQuery<OnboardingDetails, FetchError>({
    queryKey: onboardingDetailsKey,
    queryFn: () => requestFetch<OnboardingDetails>("/api/workspace/onboarding/details"),
  });
}

export function useInvalidateOnboardingDetails() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: onboardingDetailsKey });
}
