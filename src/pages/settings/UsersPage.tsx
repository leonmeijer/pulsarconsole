import { useState } from 'react';
import {
  Users,
  Shield,
  Plus,
  X,
  Loader2,
  Search,
  Check,
  Mail,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useUsers,
  useRoles,
  useAssignUserRole,
  useRevokeUserRole,
  useDeleteUser,
} from '@/api/hooks';
import type { UserWithRoles } from '@/api/types';
import { ConfirmDialog } from '@/components/shared';

export default function UsersPage() {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: roles } = useRoles();
  const assignRole = useAssignUserRole();
  const revokeRole = useRevokeUserRole();
  const deleteUser = useDeleteUser();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignRole, setShowAssignRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<UserWithRoles | null>(null);

  const filteredUsers = users?.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAssignRole = async (userId: string) => {
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    try {
      await assignRole.mutateAsync({ userId, roleId: selectedRole });
      toast.success('Role assigned successfully');
      setShowAssignRole(null);
      setSelectedRole('');
    } catch {
      toast.error('Failed to assign role');
    }
  };

  const handleRevokeRole = async (userId: string, roleId: string, roleName: string) => {
    try {
      await revokeRole.mutateAsync({ userId, roleId });
      toast.success(`Role "${roleName}" revoked`);
    } catch {
      toast.error('Failed to revoke role');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteUser.mutateAsync(deleteConfirm.id);
      toast.success(`User "${deleteConfirm.display_name || deleteConfirm.email}" deleted`);
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const hasSuperuserRole = (user: UserWithRoles) => {
    return user.roles.some((role) => role.role_name === 'superuser');
  };

  const getInitials = (user: UserWithRoles) => {
    if (user.display_name) {
      return user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };

  const getAvailableRoles = (user: UserWithRoles) => {
    const assignedRoleIds = new Set(user.roles.map((r) => r.role_id));
    return roles?.filter((role) => !assignedRoleIds.has(role.id)) || [];
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            View users and manage their role assignments
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by email or name..."
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Users List */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        {usersLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="divide-y divide-white/10">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-white">{getInitials(user)}</span>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">
                        {user.display_name || 'Unnamed User'}
                      </span>
                      {!user.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {user.email}
                      </span>
                    </div>

                    {/* Roles */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role.role_id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                          >
                            <Shield size={10} />
                            {role.role_name}
                            {role.role_name !== 'superuser' && (
                              <button
                                onClick={() => handleRevokeRole(user.id, role.role_id, role.role_name)}
                                className="ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
                                title="Remove role"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No roles assigned</span>
                      )}

                      {/* Add Role Button */}
                      {showAssignRole === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Select role...</option>
                            {getAvailableRoles(user).map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssignRole(user.id)}
                            disabled={assignRole.isPending || !selectedRole}
                            className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                          >
                            {assignRole.isPending ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowAssignRole(null);
                              setSelectedRole('');
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        getAvailableRoles(user).length > 0 && (
                          <button
                            onClick={() => setShowAssignRole(user.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 text-muted-foreground text-xs rounded-full hover:border-white/40 hover:text-foreground transition-colors"
                          >
                            <Plus size={10} />
                            Add Role
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  {!hasSuperuserRole(user) && (
                    <button
                      onClick={() => setDeleteConfirm(user)}
                      className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors flex-shrink-0 self-start"
                      title="Delete user"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            {searchQuery ? (
              <>
                <p className="text-muted-foreground">No users found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try adjusting your search query
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No users yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Users will appear here after they log in
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="glass rounded-xl p-4 border border-white/10 bg-primary/5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">About Role Assignments</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Roles determine what actions users can perform in Pulsar Console.
              Each role grants specific permissions for managing tenants, namespaces,
              topics, and other Pulsar resources. System roles cannot be removed from users.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Users awaiting access approval can be activated by assigning them a role.
              Once a role is assigned, the user gains the corresponding permissions
              and can access the console.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              When OIDC authentication is enabled and no users exist in the system,
              the first user to sign in is automatically assigned the superuser role,
              granting full administrative access. Subsequent users must be assigned
              roles by an administrator before they can access the console.
            </p>
          </div>
        </div>
      </div>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteConfirm?.display_name || deleteConfirm?.email}"? This action cannot be undone. All associated sessions and API tokens will also be deleted.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteUser}
        variant="danger"
        loading={deleteUser.isPending}
      />
    </div>
  );
}
