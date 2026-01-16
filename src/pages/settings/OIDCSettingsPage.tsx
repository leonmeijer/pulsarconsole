import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useEnvironments,
  useOIDCProvider,
  useUpdateOIDCProvider,
  useRoles,
} from '@/api/hooks';
import type { Role } from '@/api/types';

interface GroupRoleMapping {
  oidc_group: string;
  role_name: string;
}

export default function OIDCSettingsPage() {
  const { data: environments, isLoading: envsLoading } = useEnvironments();
  const { data: roles } = useRoles();
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  const { data: provider, isLoading: providerLoading, refetch } = useOIDCProvider(selectedEnvId);
  const updateProvider = useUpdateOIDCProvider();

  // Local state for editing
  const [adminGroups, setAdminGroups] = useState<string[]>([]);
  const [newAdminGroup, setNewAdminGroup] = useState('');
  const [groupMappings, setGroupMappings] = useState<GroupRoleMapping[]>([]);
  const [newMapping, setNewMapping] = useState<GroupRoleMapping>({ oidc_group: '', role_name: '' });
  const [roleClaim, setRoleClaim] = useState('groups');
  const [syncRolesOnLogin, setSyncRolesOnLogin] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-select first environment
  useEffect(() => {
    if (environments && environments.length > 0 && !selectedEnvId) {
      const activeEnv = environments.find(e => e.is_active);
      setSelectedEnvId(activeEnv?.id || environments[0].id);
    }
  }, [environments, selectedEnvId]);

  // Load provider data into local state
  useEffect(() => {
    if (provider) {
      setAdminGroups(provider.admin_groups || []);
      const mappings: GroupRoleMapping[] = provider.group_role_mappings
        ? Object.entries(provider.group_role_mappings).map(([oidc_group, role_name]) => ({
            oidc_group,
            role_name,
          }))
        : [];
      setGroupMappings(mappings);
      setRoleClaim(provider.role_claim || 'groups');
      setSyncRolesOnLogin(provider.sync_roles_on_login);
      setHasChanges(false);
    } else {
      setAdminGroups([]);
      setGroupMappings([]);
      setRoleClaim('groups');
      setSyncRolesOnLogin(true);
      setHasChanges(false);
    }
  }, [provider]);

  const handleAddAdminGroup = () => {
    if (!newAdminGroup.trim()) return;
    if (adminGroups.includes(newAdminGroup.trim())) {
      toast.error('Group already exists');
      return;
    }
    setAdminGroups([...adminGroups, newAdminGroup.trim()]);
    setNewAdminGroup('');
    setHasChanges(true);
  };

  const handleRemoveAdminGroup = (group: string) => {
    setAdminGroups(adminGroups.filter(g => g !== group));
    setHasChanges(true);
  };

  const handleAddMapping = () => {
    if (!newMapping.oidc_group.trim() || !newMapping.role_name) {
      toast.error('Both OIDC group and role are required');
      return;
    }
    if (groupMappings.some(m => m.oidc_group === newMapping.oidc_group.trim())) {
      toast.error('Mapping for this group already exists');
      return;
    }
    setGroupMappings([...groupMappings, { ...newMapping, oidc_group: newMapping.oidc_group.trim() }]);
    setNewMapping({ oidc_group: '', role_name: '' });
    setHasChanges(true);
  };

  const handleRemoveMapping = (oidcGroup: string) => {
    setGroupMappings(groupMappings.filter(m => m.oidc_group !== oidcGroup));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedEnvId || !provider) return;

    const mappingsObj: Record<string, string> = {};
    groupMappings.forEach(m => {
      mappingsObj[m.oidc_group] = m.role_name;
    });

    try {
      await updateProvider.mutateAsync({
        environmentId: selectedEnvId,
        data: {
          admin_groups: adminGroups.length > 0 ? adminGroups : undefined,
          group_role_mappings: Object.keys(mappingsObj).length > 0 ? mappingsObj : undefined,
          role_claim: roleClaim,
          sync_roles_on_login: syncRolesOnLogin,
        },
      });
      toast.success('OIDC settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save OIDC settings');
    }
  };

  if (envsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">OIDC Group Mapping</h1>
              <p className="text-muted-foreground text-sm">
                Configure automatic role assignment based on OIDC groups
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Environment Selector */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Environment
          </label>
          <select
            value={selectedEnvId}
            onChange={(e) => setSelectedEnvId(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {environments?.map(env => (
              <option key={env.id} value={env.id}>
                {env.name} {env.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {providerLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !provider ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-amber-500">No OIDC Provider Configured</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This environment does not have an OIDC provider configured.
                OIDC group mapping requires an OIDC provider to be set up first.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Global Config Banner */}
            {provider.is_global && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-start gap-3">
                <Info className="text-purple-400 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-purple-300">
                  <p className="font-medium">Using Global OIDC Configuration</p>
                  <p className="mt-1 text-purple-300/80">
                    OIDC is configured via environment variables. Group mapping settings you configure here
                    will be saved to the database and will override the global defaults.
                  </p>
                </div>
              </div>
            )}

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
              <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-blue-300">
                Users logging in via OIDC will automatically be assigned roles based on their group membership.
                Groups are read from the <code className="bg-black/30 px-1.5 py-0.5 rounded">{roleClaim}</code> claim.
              </p>
            </div>

            {/* Role Claim Setting */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Role Claim Configuration</h2>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    OIDC Claim Name
                  </label>
                  <input
                    type="text"
                    value={roleClaim}
                    onChange={(e) => { setRoleClaim(e.target.value); setHasChanges(true); }}
                    placeholder="groups"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The OIDC claim that contains user groups (e.g., "groups", "roles", "memberOf")
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="syncRoles"
                    checked={syncRolesOnLogin}
                    onChange={(e) => { setSyncRolesOnLogin(e.target.checked); setHasChanges(true); }}
                    className="w-4 h-4 rounded bg-black/20 border-white/10 text-primary focus:ring-primary/50"
                  />
                  <label htmlFor="syncRoles" className="text-sm">
                    Sync roles on every login (removes roles not in OIDC groups)
                  </label>
                </div>
              </div>
            </div>

            {/* Admin Groups Section */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-red-400" />
                <h2 className="text-lg font-semibold">Global Admin Groups</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Users in these OIDC groups will automatically become global administrators with full access.
              </p>

              {/* Existing Admin Groups */}
              <div className="space-y-2 mb-4">
                {adminGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No admin groups configured</p>
                ) : (
                  adminGroups.map(group => (
                    <div
                      key={group}
                      className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-2"
                    >
                      <span className="font-mono text-sm">{group}</span>
                      <button
                        onClick={() => handleRemoveAdminGroup(group)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Admin Group */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAdminGroup}
                  onChange={(e) => setNewAdminGroup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAdminGroup()}
                  placeholder="Enter OIDC group name (e.g., admins)"
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={handleAddAdminGroup}
                  disabled={!newAdminGroup.trim()}
                  className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            {/* Group to Role Mappings Section */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-blue-400" />
                <h2 className="text-lg font-semibold">Group to Role Mappings</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Map OIDC groups to specific roles in this environment. Users will be assigned the corresponding role when they log in.
              </p>

              {/* Existing Mappings */}
              <div className="space-y-2 mb-4">
                {groupMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No group mappings configured</p>
                ) : (
                  groupMappings.map(mapping => (
                    <div
                      key={mapping.oidc_group}
                      className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{mapping.oidc_group}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-sm">
                          {mapping.role_name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMapping(mapping.oidc_group)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Mapping */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMapping.oidc_group}
                  onChange={(e) => setNewMapping({ ...newMapping, oidc_group: e.target.value })}
                  placeholder="OIDC group name"
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <select
                  value={newMapping.role_name}
                  onChange={(e) => setNewMapping({ ...newMapping, role_name: e.target.value })}
                  className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Select role...</option>
                  {roles?.map((role: Role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddMapping}
                  disabled={!newMapping.oidc_group.trim() || !newMapping.role_name}
                  className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            {/* Save Button */}
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <button
                  onClick={handleSave}
                  disabled={updateProvider.isPending}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {updateProvider.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Save Changes
                </button>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
