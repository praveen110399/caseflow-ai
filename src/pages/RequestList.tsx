import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { StatusBadge, PriorityBadge } from "@/components/requests/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";

export default function RequestList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: requests, isLoading } = useRequests({
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    request_type: typeFilter !== "all" ? typeFilter : undefined,
    search: search || undefined,
  });

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Requests</h1>
          <p className="text-muted-foreground">Manage and track all internal requests</p>
        </div>
        <Button onClick={() => navigate("/requests/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Request
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="finalized">Finalized</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="access">Access</SelectItem>
            <SelectItem value="issue">Issue</SelectItem>
            <SelectItem value="information">Information</SelectItem>
            <SelectItem value="change">Change</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Request ID</TableHead>
              <TableHead>Requestor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !requests?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No requests found. Create your first request to get started.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => {
                const isOverdue =
                  req.due_date &&
                  isPast(new Date(req.due_date)) &&
                  req.status !== "finalized";
                return (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/requests/${req.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {req.request_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.requestor_name}</p>
                        <p className="text-xs text-muted-foreground">{req.requestor_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{req.request_type}</TableCell>
                    <TableCell><PriorityBadge priority={req.priority} /></TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {req.due_date ? format(new Date(req.due_date), "MMM d, yyyy") : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(req.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
