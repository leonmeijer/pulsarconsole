import { motion } from "framer-motion";
import { Settings, CheckCircle, XCircle, Loader2, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useEnvironment, useCreateEnvironment, useTestEnvironment } from "@/api/hooks";

export default function EnvironmentPage() {
    const { data: environment, isLoading, refetch } = useEnvironment();
    const createEnvironment = useCreateEnvironment();
    const testEnvironment = useTestEnvironment();

    const [formData, setFormData] = useState({
        name: "",
        admin_url: "",
        auth_mode: "none" as "none" | "token",
        token: "",
        validate_connectivity: true,
    });

    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
        latency_ms?: number;
    } | null>(null);

    const handleTest = async () => {
        setTestResult(null);
        try {
            const result = await testEnvironment.mutateAsync({
                admin_url: formData.admin_url,
                token: formData.auth_mode === "token" ? formData.token : undefined,
            });
            setTestResult(result);
        } catch (error) {
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
            await createEnvironment.mutateAsync({
                name: formData.name.trim(),
                admin_url: formData.admin_url.trim(),
                auth_mode: formData.auth_mode,
                token: formData.auth_mode === "token" ? formData.token : undefined,
                validate_connectivity: formData.validate_connectivity,
            });
            toast.success("Environment configured successfully");
            refetch();
        } catch (error) {
            toast.error("Failed to save environment configuration");
        }
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold">Environment</h1>
                <p className="text-muted-foreground mt-1">Configure your Pulsar cluster connection.</p>
            </div>

            {isLoading ? (
                <div className="glass h-48 rounded-2xl animate-pulse" />
            ) : environment ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-2xl"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-500/10 rounded-xl">
                            <CheckCircle size={24} className="text-green-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold">{environment.name}</h3>
                            <div className="text-muted-foreground mt-1">{environment.admin_url}</div>
                            <div className="flex gap-4 mt-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Auth:</span>{" "}
                                    <span className="capitalize">{environment.auth_mode}</span>
                                </div>
                                {environment.has_token && (
                                    <div className="text-green-400">Token configured</div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-2xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Settings size={24} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Configure Pulsar Connection</h3>
                            <p className="text-muted-foreground text-sm">Set up your Pulsar admin API connection.</p>
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
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Admin URL</label>
                            <input
                                type="text"
                                value={formData.admin_url}
                                onChange={(e) => setFormData({ ...formData, admin_url: e.target.value })}
                                placeholder="http://localhost:8080"
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Authentication</label>
                            <select
                                value={formData.auth_mode}
                                onChange={(e) => setFormData({ ...formData, auth_mode: e.target.value as "none" | "token" })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            >
                                <option value="none">No Authentication</option>
                                <option value="token">Token Authentication</option>
                            </select>
                        </div>

                        {formData.auth_mode === "token" && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                            >
                                <label className="block text-sm font-medium mb-2">Token</label>
                                <input
                                    type="password"
                                    value={formData.token}
                                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                                    placeholder="Enter your authentication token"
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                                />
                            </motion.div>
                        )}

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
                                Test Connection
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formData.name || !formData.admin_url || createEnvironment.isPending}
                                className="flex-1 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-semibold"
                            >
                                {createEnvironment.isPending ? "Saving..." : "Save Configuration"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
