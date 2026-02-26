import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import axios from "axios";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type ManageUserPayload,
} from "@/api/users";
import { extractErrorMessage } from "@/api/client";
import type { PaginationMeta, User, UserRole } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionAlert } from "@/components/ui/action-alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface ManageUserFormState {
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  password: string;
}

const DEFAULT_USER_FORM: ManageUserFormState = {
  name: "",
  email: "",
  role: "election_admin",
  is_active: true,
  password: "",
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  election_admin: "Election Admin",
  voter: "Voter",
};

export function SettingsPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState<UserRole | undefined>(undefined);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState<ManageUserFormState>(DEFAULT_USER_FORM);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => [
      { value: "super_admin", label: ROLE_LABELS.super_admin },
      { value: "election_admin", label: ROLE_LABELS.election_admin },
    ],
    []
  );

  const roleFilterOptions = useMemo(() => roleOptions, [roleOptions]);

  const handleUnauthorized = useCallback(
    async (apiError: unknown) => {
      if (axios.isAxiosError(apiError) && apiError.response?.status === 401) {
        setUsers([]);
        setMeta(null);
        setSuccess(null);
        setError("Your session has expired. Please sign in again.");
        await logout();
        return true;
      }

      return false;
    },
    [logout]
  );

  const loadUsers = useCallback(async () => {
    if (user?.role !== "super_admin") {
      return;
    }

    try {
      setUsersLoading(true);
      const response = await getUsers(usersPage, 25, usersSearch, usersRoleFilter);
      setUsers(response.data);
      setMeta(response.meta);
      setError(null);
    } catch (loadError) {
      if (await handleUnauthorized(loadError)) {
        return;
      }

      setError(extractErrorMessage(loadError));
    } finally {
      setUsersLoading(false);
    }
  }, [handleUnauthorized, user?.role, usersPage, usersSearch, usersRoleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetUserForm = () => {
    setShowUserForm(false);
    setEditingUserId(null);
    setUserForm(DEFAULT_USER_FORM);
  };

  const handleSaveUser = async () => {
    if (userForm.name.trim() === "" || userForm.email.trim() === "") {
      setError("Name and email are required.");
      return;
    }

    try {
      setSubmittingUser(true);
      setError(null);
      setSuccess(null);

      const payload: ManageUserPayload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        is_active: userForm.is_active,
      };

      if (userForm.password.trim() !== "") {
        payload.password = userForm.password.trim();
      }

      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setSuccess("User updated successfully.");
      } else {
        await createUser(payload);
        setSuccess(
          payload.password ? "User created successfully." : "User created successfully. Default password is Password@123."
        );
      }

      resetUserForm();
      await loadUsers();
    } catch (saveError) {
      if (await handleUnauthorized(saveError)) {
        return;
      }

      setError(extractErrorMessage(saveError));
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleEditUser = (targetUser: User) => {
    setEditingUserId(targetUser.id);
    setShowUserForm(true);
    setUserForm({
      name: targetUser.name,
      email: targetUser.email ?? "",
      role: targetUser.role,
      is_active: targetUser.is_active,
      password: "",
    });
    setError(null);
    setSuccess(null);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) {
      return;
    }

    try {
      setDeletingUserId(userToDelete.id);
      setError(null);
      setSuccess(null);
      await deleteUser(userToDelete.id);
      await loadUsers();
      setSuccess(`User "${userToDelete.name}" deleted.`);
      setUserToDelete(null);
    } catch (deleteError) {
      if (await handleUnauthorized(deleteError)) {
        return;
      }

      setError(extractErrorMessage(deleteError));
      setUserToDelete(null);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage user accounts, roles, and account status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.role !== "super_admin" ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Only super admins can manage all user accounts from system settings.
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-[1fr_220px_auto] md:items-center">
                <Input
                  placeholder="Search by name or email"
                  value={usersSearch}
                  onChange={(event) => {
                    setUsersPage(1);
                    setUsersSearch(event.target.value);
                  }}
                />

                <Select
                  options={roleFilterOptions}
                  value={usersRoleFilter ?? ""}
                  placeholder="Filter by role"
                  onChange={(event) => {
                    setUsersPage(1);
                    const selected = event.target.value as UserRole | "";
                    setUsersRoleFilter(selected === "" ? undefined : selected);
                  }}
                />

                <Button
                  className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                  onClick={() => {
                    if (showUserForm && editingUserId === null) {
                      resetUserForm();
                    } else {
                      setShowUserForm(true);
                      setEditingUserId(null);
                      setUserForm(DEFAULT_USER_FORM);
                      setError(null);
                      setSuccess(null);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {showUserForm && editingUserId === null ? "Close Form" : "Add User"}
                </Button>
              </div>

              {showUserForm ? (
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {editingUserId ? "Edit User" : "Create User"}
                  </h3>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="manage-user-name">Name *</Label>
                      <Input
                        id="manage-user-name"
                        value={userForm.name}
                        onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="manage-user-email">Email *</Label>
                      <Input
                        id="manage-user-email"
                        type="email"
                        value={userForm.email}
                        onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="manage-user-role">Role *</Label>
                      <Select
                        id="manage-user-role"
                        options={roleOptions}
                        value={userForm.role}
                        onChange={(event) =>
                          setUserForm((current) => ({
                            ...current,
                            role: event.target.value as UserRole,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="manage-user-password">
                        Password {editingUserId ? "(optional, leave blank to keep current)" : "(optional)"}
                      </Label>
                      <Input
                        id="manage-user-password"
                        type="password"
                        value={userForm.password}
                        onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      />
                    </div>

                  </div>

                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={userForm.is_active}
                      onChange={(event) => setUserForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    Active account
                  </label>

                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={submittingUser}
                      onClick={() => {
                        void handleSaveUser();
                      }}
                    >
                      {submittingUser
                        ? editingUserId
                          ? "Saving..."
                          : "Creating..."
                        : editingUserId
                          ? "Save Changes"
                          : "Create User"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={submittingUser}
                      onClick={resetUserForm}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {error ? <ActionAlert tone="error" message={error} /> : null}
              {success ? (
                <ActionAlert tone="success" message={success} autoHideMs={1000} onAutoHide={() => setSuccess(null)} />
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading && users.length === 0
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={`users-skeleton-${index}`}>
                          <TableCell>
                            <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                          </TableCell>
                          <TableCell>
                            <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
                          </TableCell>
                          <TableCell>
                            <div className="h-6 w-24 animate-pulse rounded-full bg-secondary" />
                          </TableCell>
                          <TableCell>
                            <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="ml-auto flex w-fit items-center gap-2">
                              <div className="h-9 w-9 animate-pulse rounded-[9px] bg-secondary" />
                              <div className="h-9 w-9 animate-pulse rounded-[9px] bg-secondary" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    : users.map((managedUser) => (
                        <TableRow key={managedUser.id}>
                          <TableCell className="font-medium">{managedUser.name}</TableCell>
                          <TableCell>{managedUser.email ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{ROLE_LABELS[managedUser.role]}</Badge>
                          </TableCell>
                          <TableCell>
                            {managedUser.is_active ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-200">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                                onClick={() => {
                                  handleEditUser(managedUser);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deletingUserId === managedUser.id || managedUser.id === user?.id}
                                onClick={() => {
                                  setUserToDelete(managedUser);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                  {!usersLoading && users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={usersPage <= 1}
                    onClick={() => {
                      setUsersPage((current) => current - 1);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(meta && usersPage >= meta.last_page)}
                    onClick={() => {
                      setUsersPage((current) => current + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open && deletingUserId === null) {
            setUserToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete user <span className="font-semibold text-foreground">&quot;{userToDelete?.name}&quot;</span>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingUserId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteUser();
              }}
            >
              {deletingUserId !== null ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
