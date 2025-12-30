import { motion, AnimatePresence } from "framer-motion";
import { Settings, CheckCircle, XCircle, Loader2, Wifi, Plus, Pencil, Trash2, Globe, Power, Eye, EyeOff, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
    useEnvironments,
    useCreateEnvironment,
    useUpdateEnvironment,
    useDeleteEnvironment,
    useActivateEnvironment,
    useTestEnvironment,
} from "@/api/hooks";
import type { Environment } from "@/api/types";

interface EnvironmentFormData {
    name: string;
    admin_url: string;
    auth_mode: "none" | "token" | "oidc";
    token: string;
    validate_connectivity: boolean;
    is_shared: boolean;
}

const emptyForm: EnvironmentFormData = {
    name: "",
    admin_url: "",
    auth_mode: "none",
    token: "",
    validate_connectivity: true,
    is_shared: true,
};

export default function EnvironmentPage() {
    const { data: environments, isLoading } = useEnvironments();
    const [searchParams, setSearchParams] = useSearchParams();
    const createEnvironment = useCreateEnvironment();
    const updateEnvironment = useUpdateEnvironment();
    const deleteEnvironment = useDeleteEnvironment();
    const activateEnvironment = useActivateEnvironment();
    const testEnvironment = useTestEnvironment();

    const [showForm, setShowForm] = useState(false);
    const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [formData, setFormData] = useState<EnvironmentFormData>(emptyForm);
    const [showToken, setShowToken] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
        latency_ms?: number;
    } | null>(null);

    // Auto-open edit form if requested via URL
    useEffect(() => {
        if (!isLoading && environments && searchParams.get('edit') === 'true') {
            const activeEnv = environments.find(e => e.is_active);
            if (activeEnv) {
                openEditForm(activeEnv);
                // Clear the param after opening
                searchParams.delete('edit');
                setSearchParams(searchParams, { replace: true });
            }
        }
    }, [isLoading, environments, searchParams]);

    const resetForm = () => {
        setFormData(emptyForm);
        setTestResult(null);
        setShowForm(false);
        setEditingEnv(null);
    };

    const openCreateForm = () => {
        setFormData(emptyForm);
        setTestResult(null);
        setEditingEnv(null);
        setShowForm(true);
    };

    const openEditForm = (env: Environment) => {
        setFormData({
            name: env.name,
            admin_url: env.admin_url,
            auth_mode: env.auth_mode as "none" | "token" | "oidc",
            token: "",
            validate_connectivity: true,
            is_shared: env.is_shared,
        });
        setTestResult(null);
        setEditingEnv(env);
        setShowForm(true);
    };

    const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setFormData(prev => ({ ...prev, token: content.trim() }));
                toast.success(`Token loaded from ${file.name}`);
            }
        };
        reader.onerror = () => {
            toast.error("Failed to read token file");
        };
        reader.readAsText(file);
        // Clear input value so same file can be selected again
        e.target.value = '';
    };

    const handleTest = async () => {
        setTestResult(null);
        try {
            const result = await testEnvironment.mutateAsync({
                admin_url: formData.admin_url,
                token: formData.auth_mode === "token" ? formData.token : undefined,
            });
            setTestResult(result);
        } catch {
            setTestResult({
                success: false,
                message: "Connection test failed",
            });
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Environment name is required");
            return;
        }
        if (!formData.admin_url.trim()) {
            toast.error("Admin URL is required");
            return;
        }

        try {
            if (editingEnv) {
                await updateEnvironment.mutateAsync({
                    name: editingEnv.name,
                    data: {
                        admin_url: formData.admin_url.trim(),
                        auth_mode: formData.auth_mode,
                        oidc_mode: formData.auth_mode === "oidc" ? "passthrough" : "none",
                        token: formData.auth_mode === "token" && formData.token ? formData.token : undefined,
                        validate_connectivity: formData.validate_connectivity,
                        is_shared: formData.is_shared,
                    },
                });
                toast.success("Environment updated successfully");
            } else {
                await createEnvironment.mutateAsync({
                    name: formData.name.trim(),
                    admin_url: formData.admin_url.trim(),
                    auth_mode: formData.auth_mode,
                    oidc_mode: formData.auth_mode === "oidc" ? "passthrough" : "none",
                    token: formData.auth_mode === "token" ? formData.token : undefined,
                    validate_connectivity: formData.validate_connectivity,
                    is_shared: formData.is_shared,
                });
                toast.success("Environment created successfully");
            }
            resetForm();
        } catch {
            toast.error(editingEnv ? "Failed to update environment" : "Failed to create environment");
        }
    };

    const handleDelete = async (name: string) => {
        try {
            await deleteEnvironment.mutateAsync(name);
            toast.success("Environment deleted");
            setDeleteConfirm(null);
        } catch {
            toast.error("Failed to delete environment");
        }
    };

    const handleActivate = async (name: string) => {
        try {
            await activateEnvironment.mutateAsync(name);
            toast.success(`Switched to ${name}`);
            window.location.reload();
        } catch {
            toast.error("Failed to activate environment");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Environments</h1>
                    <p className="text-muted-foreground mt-1">Manage your Pulsar cluster connections.</p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    <Plus size={18} />
                    Add Environment
                </button>
            </div>

            {isLoading ? (
                <div className="glass h-48 rounded-2xl animate-pulse" />
            ) : environments && environments.length > 0 ? (
                <div className="grid gap-4">
                    {environments.map((env) => (
                        <motion.div
                            key={env.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`glass p-6 rounded-2xl ${env.is_active ? 'ring-2 ring-primary' : ''}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${env.is_active ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                    {env.is_active ? (
                                        <CheckCircle size={24} className="text-green-500" />
                                    ) : (
                                        <Globe size={24} className="text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold">{env.name}</h3>
                                        {env.is_active && (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground mt-1 truncate">{env.admin_url}</div>
                                    <div className="flex gap-4 mt-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Auth:</span>{" "}
                                            <span className="capitalize">{env.auth_mode}</span>
                                        </div>
                                        {env.has_token && (
                                            <div className="text-green-400">Token configured</div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!env.is_active && (
                                        <button
                                            onClick={() => handleActivate(env.name)}
                                            disabled={activateEnvironment.isPending}
                                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                            title="Activate"
                                        >
                                            <Power size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEditForm(env)}
                                        className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(env.name)}
                                        disabled={env.is_active}
                                        className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={env.is_active ? "Cannot delete active environment" : "Delete"}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-12 rounded-2xl text-center"
                >
                    <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
                        <Settings size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Environments Configured</h3>
                    <p className="text-muted-foreground mb-6">
                        Add a Pulsar cluster connection to get started.
                    </p>
                    <button
                        onClick={openCreateForm}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                        <Plus size={18} />
                        Add Your First Environment
                    </button>
                </motion.div>
            )}

            {/* Create/Edit Form Modal */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && resetForm()}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass p-6 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <Settings size={24} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">
                                        {editingEnv ? "Edit Environment" : "Add New Environment"}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {editingEnv ? "Update your Pulsar connection settings." : "Configure a new Pulsar cluster connection."}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Environment Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Production"
                                        disabled={!!editingEnv}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
                                    />
                                    {editingEnv && (
                                        <p className="text-xs text-muted-foreground mt-1">Name cannot be changed after creation</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Admin URL</label>
                                    <input
                                        type="text"
                                        value={formData.admin_url}
                                        onChange={(e) => setFormData({ ...formData, admin_url: e.target.value })}
                                        placeholder="http://pulsar:8080"
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Authentication</label>
                                    <select
                                        value={formData.auth_mode}
                                        onChange={(e) => setFormData({ ...formData, auth_mode: e.target.value as "none" | "token" | "oidc" })}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                                    >
                                        <option value="none">No Authentication</option>
                                        <option value="token">Token Authentication</option>
                                        <option value="oidc">OIDC Passthrough (Logged-in User)</option>
                                    </select>
                                    <motion.p
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={formData.auth_mode}
                                        className="mt-2 text-xs text-muted-foreground leading-relaxed"
                                    >
                                        {formData.auth_mode === "none" && (
                                            "Ensure that authenticationEnabled and authorizationEnabled are set to false in your Pulsar broker configuration. This mode provides no security."
                                        )}
                                        {formData.auth_mode === "token" && (
                                            "Uses static Pulsar JWT tokens (Symmetric or Asymmetric). The Console will use this fixed token for all administrative actions in this environment."
                                        )}
                                        {formData.auth_mode === "oidc" && (
                                            <>
                                                Forwards your active OIDC session token to the broker (Supports PKCE). Pulsar must be configured with <code className="bg-white/5 px-1 rounded text-primary">authenticationEnabled: true</code> and <code className="bg-white/5 px-1 rounded text-primary">AuthenticationProviderOAuth2</code>. The broker's <code className="bg-white/5 px-1 rounded text-primary">audience</code> must match your IdP <code className="bg-white/5 px-1 rounded text-primary">client_id</code>.
                                            </>
                                        )}
                                    </motion.p>
                                </div>

                                {formData.auth_mode === "token" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium">Token</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileRead}
                                                    className="hidden"
                                                    accept=".txt,.jwt,.key,*"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors font-medium"
                                                >
                                                    <Upload size={14} /> Upload File
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowToken(!showToken)}
                                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors font-medium"
                                                >
                                                    {showToken ? (
                                                        <><EyeOff size={14} /> Hide Token</>
                                                    ) : (
                                                        <><Eye size={14} /> Show Token</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={formData.token}
                                            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                                            placeholder={editingEnv ? "Leave empty to keep current token" : "Enter your authentication token"}
                                            rows={4}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary font-mono text-xs resize-none leading-relaxed"
                                            style={{ 
                                                WebkitTextSecurity: showToken ? 'none' : 'disc',
                                            } as any}
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Pulsar tokens are typically long strings. Use multi-line paste if needed.
                                        </p>
                                    </motion.div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="validate"
                                            checked={formData.validate_connectivity}
                                            onChange={(e) => setFormData({ ...formData, validate_connectivity: e.target.checked })}
                                            className="rounded"
                                        />
                                        <label htmlFor="validate" className="text-sm">
                                            Validate connectivity before saving
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="is_shared"
                                            checked={formData.is_shared}
                                            onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                                            className="rounded"
                                        />
                                        <label htmlFor="is_shared" className="text-sm">
                                            Shared environment (Visible to all users)
                                        </label>
                                    </div>
                                </div>

                                {testResult && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {testResult.success ? (
                                                <CheckCircle size={20} className="text-green-500" />
                                            ) : (
                                                <XCircle size={20} className="text-red-500" />
                                            )}
                                            <span>{testResult.message}</span>
                                            {testResult.latency_ms && (
                                                <span className="text-muted-foreground">
                                                    ({testResult.latency_ms.toFixed(0)}ms)
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={handleTest}
                                        disabled={!formData.admin_url || testEnvironment.isPending}
                                        className="flex items-center gap-2 px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 transition-colors"
                                    >
                                        {testEnvironment.isPending ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Wifi size={18} />
                                        )}
                                        Test
                                    </button>
                                    <button
                                        onClick={resetForm}
                                        className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!formData.name || !formData.admin_url || createEnvironment.isPending || updateEnvironment.isPending}
                                        className="flex-1 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-semibold"
                                    >
                                        {createEnvironment.isPending || updateEnvironment.isPending
                                            ? "Saving..."
                                            : editingEnv
                                            ? "Update"
                                            : "Create"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass p-6 rounded-2xl max-w-md w-full"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-500/10 rounded-xl">
                                    <Trash2 size={24} className="text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Delete Environment</h3>
                                    <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
                                </div>
                            </div>
                            <p className="mb-6">
                                Are you sure you want to delete <strong>{deleteConfirm}</strong>?
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    disabled={deleteEnvironment.isPending}
                                    className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors font-semibold"
                                >
                                    {deleteEnvironment.isPending ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
