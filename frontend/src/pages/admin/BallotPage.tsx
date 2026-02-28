import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Ellipsis,
  Eye,
  Link as LinkIcon,
  ListOrdered,
  Pencil,
  Play,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { deleteElection, getElections, updateElection } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election, ElectionStatus } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionAlert } from "@/components/ui/action-alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function BallotPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [electionToDelete, setElectionToDelete] = useState<Election | null>(null);
  const [electionToClose, setElectionToClose] = useState<Election | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const closeActionMenu = useCallback(() => {
    setOpenActionMenuId(null);
    setMenuPosition(null);
  }, []);

  const buildVotingLink = useCallback((electionId: number) => {
    const origin = window.location.origin;
    return `${origin}/access/${electionId}`;
  }, []);

  const loadElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getElections();
      setElections(data);
      setError(null);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadElections();
  }, [loadElections]);

  useEffect(() => {
    const state = location.state as
      | {
          alert?: {
            tone?: "error" | "warning" | "info" | "success";
            message?: string;
          };
        }
      | null;

    const flashMessage = state?.alert?.message;
    if (!flashMessage) {
      return;
    }

    if (state?.alert?.tone === "error") {
      setError(flashMessage);
      setSuccess(null);
    } else {
      setSuccess(flashMessage);
      setError(null);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (openActionMenuId === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-election-actions-trigger]") ||
        target?.closest("[data-election-actions-menu]")
      ) {
        return;
      }

      closeActionMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeActionMenu, openActionMenuId]);

  useEffect(() => {
    if (openActionMenuId === null) {
      return;
    }

    const handleViewportChange = () => {
      closeActionMenu();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeActionMenu, openActionMenuId]);

  const toggleStatus = async (election: Election) => {
    const nextStatus: ElectionStatus = election.status === "open" ? "closed" : "open";

    if (nextStatus === "open") {
      const openValidationMessage = getOpenValidationMessage(election);

      if (openValidationMessage) {
        setSuccess(null);
        setError(openValidationMessage);
        closeActionMenu();
        return;
      }
    }

    try {
      setError(null);
      setSuccess(null);
      setUpdatingId(election.id);
      await updateElection(election.id, { status: nextStatus });
      await loadElections();
      setSuccess(
        nextStatus === "open"
          ? `Election "${election.title}" opened successfully.`
          : `Election "${election.title}" closed successfully.`
      );
    } catch (statusError) {
      setSuccess(null);
      if (axios.isAxiosError(statusError) && statusError.response?.status === 403) {
        await refreshUser();
        setError("You are not allowed to perform this action. Please sign in with an authorized admin account.");
      } else {
        setError(extractErrorMessage(statusError));
      }
    } finally {
      setUpdatingId(null);
      closeActionMenu();
    }
  };

  const confirmDeleteElection = async () => {
    if (!electionToDelete) {
      return;
    }

    try {
      setDeletingId(electionToDelete.id);
      setError(null);
      setSuccess(null);
      await deleteElection(electionToDelete.id);
      await loadElections();
      setSuccess(`Election "${electionToDelete.title}" deleted successfully.`);
      setElectionToDelete(null);
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmCloseElection = async () => {
    if (!electionToClose) {
      return;
    }

    const targetElection = electionToClose;
    setElectionToClose(null);
    await toggleStatus(targetElection);
  };

  const handleToggleActionMenu = (event: ReactMouseEvent<HTMLButtonElement>, electionId: number) => {
    if (openActionMenuId === electionId) {
      closeActionMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const viewportPadding = 8;
    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );

    setMenuPosition({
      top: rect.bottom + 8,
      left,
    });
    setOpenActionMenuId(electionId);
  };

  const selectedElection = useMemo(
    () => elections.find((item) => item.id === openActionMenuId) ?? null,
    [elections, openActionMenuId]
  );

  const canDeleteElection = useCallback(
    (election: Election) => {
      if (election.status === "draft") {
        return true;
      }

      return user?.role === "super_admin" && election.status === "closed";
    },
    [user?.role]
  );

  const canModifyElectionDetails = useCallback(
    (election: Election) => election.status !== "open" || user?.role === "super_admin",
    [user?.role]
  );

  const getOpenValidationMessage = useCallback((election: Election): string | null => {
    if (election.positions.length === 0) {
      return "Election cannot be opened because no positions are configured.";
    }

    const incompletePosition = election.positions.find(
      (position) => position.candidates.length < position.max_votes_allowed
    );

    if (!incompletePosition) {
      return null;
    }

    const requiredSlots = incompletePosition.max_votes_allowed;
    const currentCandidates = incompletePosition.candidates.length;
    const slotLabel = requiredSlots === 1 ? "slot is" : "slots are";
    const candidateLabel = requiredSlots === 1 ? "candidate" : "candidates";

    return `${incompletePosition.title} position ${slotLabel} not filled (${currentCandidates}/${requiredSlots} ${candidateLabel}).`;
  }, []);

  const ongoingElectionEditLabel = useCallback(
    (baseLabel: string, election: Election) =>
      canModifyElectionDetails(election) ? baseLabel : `${baseLabel} (Super admin only while open)`,
    [canModifyElectionDetails]
  );

  const getDeleteElectionLabel = useCallback(
    (election: Election) => {
      if (election.status === "draft") {
        return "Delete Election";
      }

      if (election.status === "closed") {
        return user?.role === "super_admin"
          ? "Delete Election"
          : "Delete Election (Super admin only when closed)";
      }

      return "Delete Election (Draft only)";
    },
    [user?.role]
  );

  const actionMenu =
    selectedElection && menuPosition
      ? createPortal(
          <div
            data-election-actions-menu
            className="animate-menu-pop fixed z-[80] w-56 origin-top-right rounded-xl border bg-card p-1 shadow-card"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {canModifyElectionDetails(selectedElection) ? (
              <Link
                to={`/admin/elections/${selectedElection.id}/edit`}
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                onClick={closeActionMenu}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Edit Election
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60"
                title="Only super admins can edit an election while it is open."
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                {ongoingElectionEditLabel("Edit Election", selectedElection)}
              </button>
            )}

            {canModifyElectionDetails(selectedElection) ? (
              <Link
                to={`/admin/elections/${selectedElection.id}/positions`}
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                onClick={closeActionMenu}
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                Manage Positions
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60"
                title="Only super admins can manage positions while the election is open."
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                {ongoingElectionEditLabel("Manage Positions", selectedElection)}
              </button>
            )}

            {canModifyElectionDetails(selectedElection) ? (
              <Link
                to={`/admin/elections/${selectedElection.id}/candidates`}
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                onClick={closeActionMenu}
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                Manage Candidates
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60"
                title="Only super admins can manage candidates while the election is open."
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                {ongoingElectionEditLabel("Manage Candidates", selectedElection)}
              </button>
            )}

            {selectedElection.status === "draft" ? (
              <Link
                to={`/admin/elections/${selectedElection.id}/preview`}
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                onClick={closeActionMenu}
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
                Test Preview
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60"
                title="Test preview is only available while election is in draft mode."
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
                Test Preview (Draft only)
              </button>
            )}

            <button
              type="button"
              className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deletingId === selectedElection.id || !canDeleteElection(selectedElection)}
              onClick={() => {
                setElectionToDelete(selectedElection);
                closeActionMenu();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {getDeleteElectionLabel(selectedElection)}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ballot</CardTitle>
        <CardDescription>Manage ballots, candidate lineup, and election status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/admin/elections/create">Create Election</Link>
          </Button>
        </div>

        {error ? (
          <ActionAlert
            tone="error"
            message={error}
            autoHideMs={3000}
            onAutoHide={() => setError(null)}
            onClose={() => setError(null)}
          />
        ) : null}
        {success ? <ActionAlert tone="success" message={success} autoHideMs={1000} onAutoHide={() => setSuccess(null)} /> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Election</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && elections.length === 0
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`ballot-skeleton-${index}`}>
                    <TableCell>
                      <div className="h-3 w-44 animate-pulse rounded bg-secondary" />
                      <div className="mt-2 h-3 w-60 animate-pulse rounded bg-secondary" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-16 animate-pulse rounded-full bg-secondary" />
                    </TableCell>
                    <TableCell>
                      <div className="h-3 w-36 animate-pulse rounded bg-secondary" />
                      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-secondary" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto h-9 w-9 animate-pulse rounded-[9px] bg-secondary" />
                    </TableCell>
                  </TableRow>
                ))
              : elections.map((election) => (
                  <TableRow key={election.id}>
                    <TableCell>
                      <p className="font-medium">{election.title}</p>
                      <p className="text-xs text-muted-foreground">{election.description ?? "No description provided."}</p>
                      {election.status === "open" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <a
                            href={buildVotingLink(election.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-primary hover:bg-secondary/80"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                            Open Voter Link
                          </a>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          election.status === "open"
                            ? "default"
                            : election.status === "closed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {election.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{new Date(election.start_datetime).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(election.end_datetime).toLocaleString()}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/elections/${election.id}/results`}>Results</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className={election.status === "open" ? "" : "bg-blue-600 text-white hover:bg-blue-700"}
                          variant={election.status === "open" ? "destructive" : "default"}
                          disabled={
                            updatingId === election.id ||
                            election.status === "closed" ||
                            (election.status === "open" && user?.role !== "super_admin")
                          }
                          title={
                            election.status === "open" && user?.role !== "super_admin"
                              ? "Only super admins can modify an open election."
                              : election.status !== "open"
                                ? getOpenValidationMessage(election) ?? undefined
                                : undefined
                          }
                          onClick={() => {
                            if (election.status === "open") {
                              setElectionToClose(election);
                              return;
                            }

                            void toggleStatus(election);
                          }}
                        >
                          {updatingId === election.id ? (
                            "Updating..."
                          ) : election.status === "open" ? (
                            <>
                              <Square className="mr-1.5 h-4 w-4" />
                              Close
                            </>
                          ) : (
                            <>
                              <Play className="mr-1.5 h-4 w-4" />
                              Open
                            </>
                          )}
                        </Button>
                        <div data-election-actions-trigger>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 w-9 p-0"
                            aria-label={`Open actions for ${election.title}`}
                            onClick={(event) => {
                              handleToggleActionMenu(event, election.id);
                            }}
                          >
                            <Ellipsis className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!loading && elections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No ballots found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog
        open={Boolean(electionToClose)}
        onOpenChange={(open) => {
          if (!open && updatingId === null) {
            setElectionToClose(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Close Election</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to close the election{" "}
              <span className="font-semibold text-foreground">&quot;{electionToClose?.title}&quot;</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingId !== null}>No</AlertDialogCancel>
            <AlertDialogAction
              disabled={updatingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmCloseElection();
              }}
            >
              {updatingId !== null ? "Closing..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(electionToDelete)}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setElectionToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Election
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete election <span className="font-semibold text-foreground">&quot;{electionToDelete?.title}&quot;</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteElection();
              }}
            >
              {deletingId !== null ? "Deleting..." : "Delete Election"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {actionMenu}
    </Card>
  );
}
