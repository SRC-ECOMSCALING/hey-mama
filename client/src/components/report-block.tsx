import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export type ReportTargetType = "profile" | "marketplace_item" | "service" | "message" | "review";

interface ReportBlockControlsProps {
  // The user the content belongs to (and who gets blocked)
  targetUserId: string;
  targetType: ReportTargetType;
  // Id of the specific content being reported (item id, match id, …)
  targetId?: string;
  // Called after a successful block (close the modal / navigate away)
  onBlocked?: () => void;
  // "buttons" = full-width outline buttons; "icons" = compact icon buttons for headers
  variant?: "buttons" | "icons";
  className?: string;
}

// App Store 1.2: shared flag-content + block-user controls, reused on every
// surface that shows user-generated content.
export default function ReportBlockControls({
  targetUserId,
  targetType,
  targetId,
  onBlocked,
  variant = "buttons",
  className = "",
}: ReportBlockControlsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports", {
        targetType,
        targetId,
        reportedUserId: targetUserId,
        reason,
        details,
      });
      return res.json();
    },
    onSuccess: () => {
      setReportOpen(false);
      setDetails("");
      toast({ title: t("reportSubmittedTitle"), description: t("reportSubmittedDescription") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/blocks", { blockedUserId: targetUserId });
      return res.json();
    },
    onSuccess: () => {
      setBlockOpen(false);
      // Refetch everything so the blocked user's content disappears instantly
      queryClient.invalidateQueries();
      toast({ title: t("userBlockedTitle"), description: t("userBlockedDescription") });
      onBlocked?.();
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  const REASONS = [
    { value: "inappropriate", label: t("reportReasonInappropriate") },
    { value: "spam", label: t("reportReasonSpam") },
    { value: "harassment", label: t("reportReasonHarassment") },
    { value: "scam", label: t("reportReasonScam") },
    { value: "other", label: t("reportReasonOther") },
  ];

  return (
    <>
      {variant === "icons" ? (
        <div className={`flex items-center gap-1 ${className}`}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-gray-500"
            onClick={() => setReportOpen(true)}
            title={t("reportContentAction")}
            data-testid="button-report"
          >
            <Flag className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-red-500"
            onClick={() => setBlockOpen(true)}
            title={t("blockUserAction")}
            data-testid="button-block"
          >
            <Ban className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className={`flex gap-2 ${className}`}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-gray-600"
            onClick={() => setReportOpen(true)}
            data-testid="button-report"
          >
            <Flag className="h-4 w-4 mr-2" />
            {t("reportContentAction")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setBlockOpen(true)}
            data-testid="button-block"
          >
            <Ban className="h-4 w-4 mr-2" />
            {t("blockUserAction")}
          </Button>
        </div>
      )}

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-report">
          <DialogHeader>
            <DialogTitle>{t("reportDialogTitle")}</DialogTitle>
            <DialogDescription>{t("reportDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("reportReason")}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-report-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("reportDetailsLabel")}</Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("reportDetailsPlaceholder")}
                rows={3}
                data-testid="input-report-details"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReportOpen(false)} data-testid="button-cancel-report">
              {t("cancel")}
            </Button>
            <Button
              className="text-white"
              style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submitReport")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block confirmation dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-block">
          <DialogHeader>
            <DialogTitle>{t("blockDialogTitle")}</DialogTitle>
            <DialogDescription>{t("blockDialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBlockOpen(false)} data-testid="button-cancel-block">
              {t("cancel")}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("blockAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
