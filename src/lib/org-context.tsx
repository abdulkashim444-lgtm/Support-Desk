import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type OrgRole = Database["public"]["Enums"]["org_role"];

export interface Membership {
  id: string;
  org_id: string;
  role: OrgRole;
  organizations: { id: string; name: string; slug: string };
}

interface OrgContextValue {
  memberships: Membership[];
  currentOrg: Membership["organizations"] | null;
  currentRole: OrgRole | null;
  setCurrentOrgId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
}

const STORAGE_KEY = "supportdesk.currentOrgId";
const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, org_id, role, organizations!inner(id, name, slug)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = data ?? [];
  const currentMembership =
    memberships.find((m) => m.org_id === currentOrgId) ?? memberships[0] ?? null;

  useEffect(() => {
    if (!currentOrgId && currentMembership) {
      setCurrentOrgIdState(currentMembership.org_id);
      localStorage.setItem(STORAGE_KEY, currentMembership.org_id);
    }
  }, [currentOrgId, currentMembership]);

  const setCurrentOrgId = (id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <OrgContext.Provider
      value={{
        memberships,
        currentOrg: currentMembership?.organizations ?? null,
        currentRole: currentMembership?.role ?? null,
        setCurrentOrgId,
        isLoading,
        refetch,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}

export function canManage(role: OrgRole | null) {
  return role === "owner" || role === "admin";
}
export function canWrite(role: OrgRole | null) {
  return role === "owner" || role === "admin" || role === "agent";
}
