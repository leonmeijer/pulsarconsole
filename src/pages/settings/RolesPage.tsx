import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Lock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useRoles,
  usePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useAddRolePermission,
  useRemoveRolePermission,
} from '@/api/hooks';
import type { Role, Permission, RolePermission } from '@/api/types';
import { ConfirmDialog } from '@/components/shared';

interface RoleFormData {
  name: string;
  description: string;
}

export default function RolesPage() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: permissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const addPermission = useAddRolePermission();
  const removePermission = useRemoveRolePermission();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);
  const [showAddPermission, setShowAddPermission] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<string>('');
  const [resourcePattern, setResourcePattern] = useState<string>('');

  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
  });

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setShowCreateForm(false);
    setEditingRole(null);
  };

  const handleCreateRole = async () => {
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      await createRole.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
      });
      toast.success('Role created successfully');
      resetForm();
    } catch {
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      await updateRole.mutateAsync({
        roleId: editingRole.id,
        name: formData.name,
        description: formData.description || undefined,
      });
      toast.success('Role updated successfully');
      resetForm();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteRole.mutateAsync(deleteConfirm.id);
      toast.success('Role deleted successfully');
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete role');
    }
  };

  const handleAddPermission = async (roleId: string) => {
    if (!selectedPermission) {
      toast.error('Please select a permission');
      return;
    }

    try {
      await addPermission.mutateAsync({
        roleId,
        permissionId: selectedPermission,
        resourcePattern: resourcePattern || undefined,
      });
      toast.success('Permission added');
      setShowAddPermission(null);
      setSelectedPermission('');
      setResourcePattern('');
    } catch {
      toast.error('Failed to add permission');
    }
  };

  const handleRemovePermission = async (roleId: string, rolePermissionId: string) => {
    try {
      await removePermission.mutateAsync({ roleId, rolePermissionId });
      toast.success('Permission removed');
    } catch {
      toast.error('Failed to remove permission');
    }
  };

  const openEditForm = (role: Role) => {
    setFormData({
      name: role.name,
      description: role.description || '',
    });
    setEditingRole(role);
    setShowCreateForm(true);
  };

  const groupPermissionsByLevel = (perms: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};
    perms?.forEach((perm) => {
      if (!grouped[perm.resource_level]) {
        grouped[perm.resource_level] = [];
      }
      grouped[perm.resource_level].push(perm);
    });
    return grouped;
  };

  const groupedPermissions = permissions ? groupPermissionsByLevel(permissions) : {};

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage roles and their associated permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Create Role
        </button>
      </div>

      {/* Roles List */}
      <div className="space-y-4">
        {rolesLoading ? (
          <div className="glass rounded-xl p-8 flex items-center justify-center border border-white/10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : roles && roles.length > 0 ? (
          roles.map((role) => (
            <motion.div
              key={role.id}
              layout
              className="glass rounded-xl border border-white/10 overflow-hidden"
            >
              {/* Role Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              >
                <button className="p-1">
                  {expandedRole === role.id ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{role.name}</span>
                    {role.is_system && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-500 rounded-full flex items-center gap-1">
                        <Lock size={10} />
                        System
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {role.permissions?.length || 0} permissions
                </div>
                {!role.is_system && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditForm(role)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit role"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(role)}
                      className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                      title="Delete role"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded Permissions */}
              <AnimatePresence>
                {expandedRole === role.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 overflow-hidden"
                  >
                    <div className="p-4 space-y-4">
                      {/* Permissions List */}
                      {role.permissions && role.permissions.length > 0 ? (
                        <div className="space-y-2">
                          {role.permissions.map((rp: RolePermission) => (
                            <div
                              key={rp.permission_id}
                              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {rp.action}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Level: {rp.resource_level}
                                  {rp.resource_pattern && (
                                    <span className="ml-2">
                                      Pattern: <code className="text-primary">{rp.resource_pattern}</code>
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!role.is_system && (
                                <button
                                  onClick={() => handleRemovePermission(role.id, rp.permission_id)}
                                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Remove permission"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No permissions assigned
                        </p>
                      )}

                      {/* Add Permission Button */}
                      {!role.is_system && (
                        <>
                          {showAddPermission === role.id ? (
                            <div className="p-4 bg-white/5 rounded-lg space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Permission</label>
                                <select
                                  value={selectedPermission}
                                  onChange={(e) => setSelectedPermission(e.target.value)}
                                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  <option value="">Select a permission...</option>
                                  {Object.entries(groupedPermissions).map(([level, perms]) => (
                                    <optgroup key={level} label={level.toUpperCase()}>
                                      {perms.map((perm) => (
                                        <option key={perm.id} value={perm.id}>
                                          {perm.action} ({perm.resource_level})
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Resource Pattern (optional)
                                </label>
                                <input
                                  type="text"
                                  value={resourcePattern}
                                  onChange={(e) => setResourcePattern(e.target.value)}
                                  placeholder="e.g., public/default/* or public/default/my-topic"
                                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Use * as wildcard. Leave empty for all resources.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setShowAddPermission(null);
                                    setSelectedPermission('');
                                    setResourcePattern('');
                                  }}
                                  className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddPermission(role.id)}
                                  disabled={addPermission.isPending}
                                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                  {addPermission.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                  Add Permission
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowAddPermission(role.id)}
                              className="w-full py-2 border border-dashed border-white/20 rounded-lg text-muted-foreground hover:text-foreground hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus size={16} />
                              Add Permission
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        ) : (
          <div className="glass rounded-xl p-8 text-center border border-white/10">
            <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No roles configured</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Create a role to start managing permissions
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Role Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-xl p-6 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Role Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Developer, Operator"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description for this role"
                    rows={3}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingRole ? handleUpdateRole : handleCreateRole}
                    disabled={createRole.isPending || updateRole.isPending}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {(createRole.isPending || updateRole.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                    {editingRole ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${deleteConfirm?.name}"? Users with this role will lose the associated permissions.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteRole}
        variant="danger"
      />
    </div>
  );
}
