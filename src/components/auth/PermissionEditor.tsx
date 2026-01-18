import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useNamespacePermissions,
  useGrantNamespacePermission,
  useRevokeNamespacePermission,
  type PulsarPermission,
} from '@/api/hooks';
import { ConfirmDialog } from '@/components/shared';

interface PermissionEditorProps {
  tenant: string;
  namespace: string;
}

const AVAILABLE_ACTIONS = [
  'produce',
  'consume',
  'functions',
  'sources',
  'sinks',
  'packages',
];

export default function PermissionEditor({
  tenant,
  namespace,
}: PermissionEditorProps) {
  const { data: permissions, isLoading } = useNamespacePermissions(
    tenant,
    namespace
  );
  const grantPermission = useGrantNamespacePermission();
  const revokePermission = useRevokeNamespacePermission();

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [revokeConfirm, setRevokeConfirm] = useState<PulsarPermission | null>(
    null
  );

  const handleAddPermission = async () => {
    if (!newRole.trim()) {
      toast.error('Role name is required');
      return;
    }
    if (selectedActions.length === 0) {
      toast.error('Select at least one action');
      return;
    }

    try {
      await grantPermission.mutateAsync({
        tenant,
        namespace,
        role: newRole.trim(),
        actions: selectedActions,
      });
      toast.success(`Permissions granted to ${newRole}`);
      setShowAddForm(false);
      setNewRole('');
      setSelectedActions([]);
    } catch {
      toast.error('Failed to grant permissions');
    }
  };

  const handleRevokePermission = async () => {
    if (!revokeConfirm) return;

    try {
      await revokePermission.mutateAsync({
        tenant,
        namespace,
        role: revokeConfirm.role,
      });
      toast.success(`Permissions revoked from ${revokeConfirm.role}`);
      setRevokeConfirm(null);
    } catch {
      toast.error('Failed to revoke permissions');
    }
  };

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  if (isLoading) {
    return (
      <div className="glass rounded-xl p-8 flex items-center justify-center border border-white/10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            Namespace Permissions
          </h3>
          <p className="text-sm text-muted-foreground">
            {tenant}/{namespace}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Grant Permission
        </button>
      </div>

      {/* Permission List */}
      <div className="space-y-2">
        {permissions?.permissions && permissions.permissions.length > 0 ? (
          permissions.permissions.map((perm: PulsarPermission) => (
            <motion.div
              key={perm.role}
              layout
              className="glass rounded-lg border border-white/10 overflow-hidden"
            >
              {/* Role Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() =>
                  setExpandedRole(
                    expandedRole === perm.role ? null : perm.role
                  )
                }
              >
                <button className="p-1">
                  {expandedRole === perm.role ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="font-medium">{perm.role}</span>
                  <p className="text-sm text-muted-foreground">
                    {perm.actions.length} permission
                    {perm.actions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {perm.actions.slice(0, 3).map((action) => (
                    <span
                      key={action}
                      className="px-2 py-0.5 text-xs bg-white/10 rounded-full"
                    >
                      {action}
                    </span>
                  ))}
                  {perm.actions.length > 3 && (
                    <span className="px-2 py-0.5 text-xs bg-white/10 rounded-full">
                      +{perm.actions.length - 3}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevokeConfirm(perm);
                  }}
                  className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                  title="Revoke permissions"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Expanded Actions */}
              <AnimatePresence>
                {expandedRole === perm.role && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 overflow-hidden"
                  >
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Granted Actions:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {perm.actions.map((action) => (
                          <span
                            key={action}
                            className="px-3 py-1.5 text-sm bg-green-500/10 text-green-500 rounded-lg flex items-center gap-2"
                          >
                            <Check size={14} />
                            {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        ) : (
          <div className="glass rounded-xl p-8 text-center border border-white/10">
            <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No permissions configured</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Grant permissions to roles to control access
            </p>
          </div>
        )}
      </div>

      {/* Add Permission Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-solid rounded-xl p-6 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">Grant Permission</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="e.g., my-app-role"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ACTIONS.map((action) => (
                      <button
                        key={action}
                        onClick={() => toggleAction(action)}
                        className={cn(
                          'px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-2',
                          selectedActions.includes(action)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        )}
                      >
                        {selectedActions.includes(action) ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} className="opacity-30" />
                        )}
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewRole('');
                      setSelectedActions([]);
                    }}
                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPermission}
                    disabled={grantPermission.isPending}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {grantPermission.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                    Grant
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeConfirm}
        onOpenChange={(open) => !open && setRevokeConfirm(null)}
        title="Revoke Permissions"
        description={`Are you sure you want to revoke all permissions from "${revokeConfirm?.role}"? This role will lose access to ${tenant}/${namespace}.`}
        confirmLabel="Revoke"
        onConfirm={handleRevokePermission}
        variant="danger"
      />
    </div>
  );
}
