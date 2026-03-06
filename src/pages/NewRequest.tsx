import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useCreateRequest, useProfiles } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function NewRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const createRequest = useCreateRequest();
  const { data: profiles } = useProfiles();

  const [requestorName, setRequestorName] = useState("");
  const [requestorEmail, setRequestorEmail] = useState("");
  const [requestorEmployeeId, setRequestorEmployeeId] = useState("");
  const [requestType, setRequestType] = useState<string>("other");
  const [sourceChannel, setSourceChannel] = useState<string>("portal");
  const [priority, setPriority] = useState<string>("medium");
  const [rawDescription, setRawDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiDetails, setAiDetails] = useState("");
  const [aiNextAction, setAiNextAction] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerateAI = async () => {
    if (!rawDescription.trim()) {
      toast({ title: "Enter a description first", variant: "destructive" });
      return;
    }
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-request-note", {
        body: { rawDescription, requestType, priority },
      });
      if (error) throw error;
      if (data) {
        setAiSummary(data.summary || "");
        setAiDetails(data.details || "");
        setAiNextAction(data.nextAction || "");
        setAiTags(data.tags || []);
        toast({ title: "AI notes generated successfully" });
      }
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        created_by: user.id,
        assigned_to: assignedTo || null,
        requestor_name: requestorName,
        requestor_email: requestorEmail,
        requestor_employee_id: requestorEmployeeId || null,
        request_type: requestType as any,
        source_channel: sourceChannel as any,
        priority: priority as any,
        raw_description: rawDescription,
        ai_summary: aiSummary || null,
        ai_details: aiDetails || null,
        ai_next_action: aiNextAction || null,
        ai_tags: aiTags.length ? aiTags : null,
      });
      toast({ title: "Request created successfully" });
      navigate("/requests");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-6 text-2xl font-bold">Create New Request</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Requestor Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requestor Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={requestorName} onChange={(e) => setRequestorName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={requestorEmail} onChange={(e) => setRequestorEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={requestorEmployeeId} onChange={(e) => setRequestorEmployeeId(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access">Access</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                    <SelectItem value="information">Information</SelectItem>
                    <SelectItem value="change">Change</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source Channel</Label>
                <Select value={sourceChannel} onValueChange={setSourceChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Raw Description *</Label>
              <Textarea
                value={rawDescription}
                onChange={(e) => setRawDescription(e.target.value)}
                placeholder="Paste the raw request text here (email, chat message, etc.)"
                rows={5}
                required
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateAI}
              disabled={generatingAi || !rawDescription.trim()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generatingAi ? "Generating..." : "Generate AI Notes"}
            </Button>
          </CardContent>
        </Card>

        {/* AI Generated Notes */}
        {(aiSummary || aiDetails || aiNextAction) && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI-Generated Notes
                <span className="text-xs text-muted-foreground font-normal">(editable)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Request Summary</Label>
                <Textarea value={aiSummary} onChange={(e) => setAiSummary(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Details / Context</Label>
                <Textarea value={aiDetails} onChange={(e) => setAiDetails(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Proposed Next Action</Label>
                <Textarea value={aiNextAction} onChange={(e) => setAiNextAction(e.target.value)} rows={2} />
              </div>
              {aiTags.length > 0 && (
                <div className="space-y-2">
                  <Label>Suggested Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {aiTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Request"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
