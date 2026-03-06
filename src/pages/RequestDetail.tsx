import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useRequest, useUpdateRequest, useFollowUps, useCreateFollowUp, useProfiles } from "@/hooks/useRequests";
import { StatusBadge, PriorityBadge } from "@/components/requests/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, MessageSquare, CheckCircle2, Clock, User } from "lucide-react";
import { format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RequestStatus = Database["public"]["Enums"]["request_status"];

const STATUS_FLOW: RequestStatus[] = ["draft", "reviewed", "approved", "finalized"];

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: request, isLoading } = useRequest(id);
  const { data: followUps } = useFollowUps(id);
  const { data: profiles } = useProfiles();
  const updateRequest = useUpdateRequest();
  const createFollowUp = useCreateFollowUp();

  const [newComment, setNewComment] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!request) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Request not found</div>;
  }

  const isFinalized = request.status === "finalized";
  const isOverdue = request.due_date && isPast(new Date(request.due_date)) && !isFinalized;
  const canEdit = !isFinalized && (isAdmin || request.created_by === user?.id);
  const currentStatusIndex = STATUS_FLOW.indexOf(request.status);

  const handleStatusChange = async (newStatus: RequestStatus) => {
    try {
      const updates: any = { id: request.id, status: newStatus };
      if (newStatus === "finalized") updates.resolved_at = new Date().toISOString();
      await updateRequest.mutateAsync(updates);
      toast({ title: `Status updated to ${newStatus}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await updateRequest.mutateAsync({ id: request.id, assigned_to: userId || null });
      toast({ title: "Assignment updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddFollowUp = async () => {
    if (!newComment.trim() || !user) return;
    try {
      await createFollowUp.mutateAsync({
        request_id: request.id,
        user_id: user.id,
        comment: newComment,
      });
      setNewComment("");
      toast({ title: "Follow-up added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRegenerateAI = async () => {
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-request-note", {
        body: {
          rawDescription: request.raw_description,
          requestType: request.request_type,
          priority: request.priority,
        },
      });
      if (error) throw error;
      await updateRequest.mutateAsync({
        id: request.id,
        ai_summary: data.summary,
        ai_details: data.details,
        ai_next_action: data.nextAction,
        ai_tags: data.tags,
      });
      toast({ title: "AI notes regenerated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  const assignedProfile = profiles?.find((p) => p.user_id === request.assigned_to);

  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <button
        onClick={() => navigate("/requests")}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Requests
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold font-mono">{request.request_number}</h1>
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                <Clock className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Created {format(new Date(request.created_at), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {currentStatusIndex < STATUS_FLOW.length - 1 && (
              <Button
                size="sm"
                onClick={() => handleStatusChange(STATUS_FLOW[currentStatusIndex + 1])}
              >
                Move to {STATUS_FLOW[currentStatusIndex + 1]}
              </Button>
            )}
            {!isFinalized && (
              <Button size="sm" variant="secondary" onClick={handleRegenerateAI} disabled={generatingAi}>
                <Sparkles className="mr-1 h-3 w-3" />
                {generatingAi ? "Generating..." : "Regenerate AI"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Raw Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw Request</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{request.raw_description}</p>
            </CardContent>
          </Card>

          {/* AI Notes */}
          {(request.ai_summary || request.ai_details || request.ai_next_action) && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI-Generated Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.ai_summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Summary</Label>
                    <p className="mt-1 text-sm">{request.ai_summary}</p>
                  </div>
                )}
                {request.ai_details && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Details & Context</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{request.ai_details}</p>
                  </div>
                )}
                {request.ai_next_action && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Proposed Next Action</Label>
                    <p className="mt-1 text-sm">{request.ai_next_action}</p>
                  </div>
                )}
                {request.ai_tags && request.ai_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {request.ai_tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Follow-ups ({followUps?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isFinalized && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a follow-up comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" onClick={handleAddFollowUp} disabled={!newComment.trim()}>
                    Add Comment
                  </Button>
                </div>
              )}
              {followUps?.length ? (
                <div className="space-y-3">
                  {followUps.map((fu) => {
                    const fuProfile = profiles?.find((p) => p.user_id === fu.user_id);
                    return (
                      <div key={fu.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{fuProfile?.display_name || "User"}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(fu.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm">{fu.comment}</p>
                        {fu.is_completed && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Requestor</Label>
                <p className="font-medium">{request.requestor_name}</p>
                <p className="text-muted-foreground">{request.requestor_email}</p>
                {request.requestor_employee_id && (
                  <p className="text-muted-foreground">ID: {request.requestor_employee_id}</p>
                )}
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <p className="capitalize">{request.request_type}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Source</Label>
                <p className="capitalize">{request.source_channel}</p>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <p className={isOverdue ? "text-destructive font-medium" : ""}>
                  {request.due_date ? format(new Date(request.due_date), "MMM d, yyyy") : "Not set"}
                </p>
              </div>
              {request.resolved_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">Resolved</Label>
                  <p>{format(new Date(request.resolved_at), "MMM d, yyyy")}</p>
                </div>
              )}
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                {canEdit ? (
                  <Select value={request.assigned_to || ""} onValueChange={handleAssign}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles?.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{assignedProfile?.display_name || "Unassigned"}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {STATUS_FLOW.map((s, i) => {
                  const isActive = i <= currentStatusIndex;
                  const isCurrent = s === request.status;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isActive
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActive && !isCurrent ? "✓" : i + 1}
                      </div>
                      <span
                        className={`capitalize text-sm ${
                          isCurrent ? "font-semibold" : isActive ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
