import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Request = Database["public"]["Tables"]["requests"]["Row"];
type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];
type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];
type FollowUp = Database["public"]["Tables"]["follow_ups"]["Row"];

export function useRequests(filters?: {
  status?: string;
  priority?: string;
  request_type?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["requests", filters],
    queryFn: async () => {
      let query = supabase.from("requests").select("*").order("created_at", { ascending: false });
      
      if (filters?.status) query = query.eq("status", filters.status as any);
      if (filters?.priority) query = query.eq("priority", filters.priority as any);
      if (filters?.request_type) query = query.eq("request_type", filters.request_type as any);
      if (filters?.search) query = query.or(`requestor_name.ilike.%${filters.search}%,request_number.ilike.%${filters.search}%,raw_description.ilike.%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as Request[];
    },
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("requests").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Request;
    },
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: Omit<RequestInsert, "request_number">) => {
      const { data, error } = await supabase
        .from("requests")
        .insert({ ...req, request_number: "" } as RequestInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: RequestUpdate & { id: string }) => {
      const { data, error } = await supabase.from("requests").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["request", data.id] });
    },
  });
}

export function useFollowUps(requestId: string | undefined) {
  return useQuery({
    queryKey: ["follow_ups", requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FollowUp[];
    },
    enabled: !!requestId,
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (followUp: Database["public"]["Tables"]["follow_ups"]["Insert"]) => {
      const { data, error } = await supabase.from("follow_ups").insert(followUp).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["follow_ups", data.request_id] });
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*");
      if (error) throw error;
      const requests = data as Request[];
      const now = new Date();

      const total = requests.length;
      const open = requests.filter((r) => r.status !== "finalized").length;
      const overdue = requests.filter(
        (r) => r.due_date && new Date(r.due_date) < now && r.status !== "finalized"
      ).length;
      const finalized = requests.filter((r) => r.status === "finalized").length;

      const byStatus = {
        draft: requests.filter((r) => r.status === "draft").length,
        reviewed: requests.filter((r) => r.status === "reviewed").length,
        approved: requests.filter((r) => r.status === "approved").length,
        finalized,
      };

      const byPriority = {
        low: requests.filter((r) => r.priority === "low").length,
        medium: requests.filter((r) => r.priority === "medium").length,
        high: requests.filter((r) => r.priority === "high").length,
      };

      const byType = {
        access: requests.filter((r) => r.request_type === "access").length,
        issue: requests.filter((r) => r.request_type === "issue").length,
        information: requests.filter((r) => r.request_type === "information").length,
        change: requests.filter((r) => r.request_type === "change").length,
        other: requests.filter((r) => r.request_type === "other").length,
      };

      return { total, open, overdue, finalized, byStatus, byPriority, byType };
    },
  });
}
