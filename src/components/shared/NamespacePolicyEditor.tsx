import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Clock, Database, Shield } from "lucide-react";
import { toast } from "sonner";
import type { NamespacePolicies } from "@/api/types";
import { useUpdateNamespacePolicies } from "@/api/hooks";
import FormField, { FormSection } from "./FormField";

interface NamespacePolicyEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant: string;
    namespace: string;
    currentPolicies: NamespacePolicies;
    onSuccess?: () => void;
}

export default function NamespacePolicyEditor({
    open,
    onOpenChange,
    tenant,
    namespace,
    currentPolicies,
    onSuccess,
}: NamespacePolicyEditorProps) {
    const [policies, setPolicies] = useState<NamespacePolicies>(currentPolicies);

    const updatePolicies = useUpdateNamespacePolicies(tenant, namespace);

    useEffect(() => {
        setPolicies(currentPolicies);
    }, [currentPolicies, open]);

    const handleSave = async () => {
        try {
            await updatePolicies.mutateAsync(policies);
            toast.success("Namespace policies updated successfully");
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to update namespace policies");
        }
    };

    const handleChange = (key: keyof NamespacePolicies, value: unknown) => {
        setPolicies(prev => ({ ...prev, [key]: value }));
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={() => onOpenChange(false)}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-solid rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div>
                                    <h2 className="text-xl font-bold">Namespace Policies</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {tenant}/{namespace}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Retention Policies */}
                                <FormSection
                                    title="Retention"
                                    description="Configure message retention settings"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg mt-1">
                                            <Clock size={18} className="text-blue-400" />
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <FormField
                                                label="Retention Time"
                                                type="number"
                                                value={policies.retention_time_minutes || ""}
                                                onChange={(e) => handleChange(
                                                    "retention_time_minutes",
                                                    e.target.value ? parseInt(e.target.value) : undefined
                                                )}
                                                hint="Minutes to retain messages (0 = unlimited)"
                                                min={0}
                                            />
                                            <FormField
                                                label="Retention Size"
                                                type="number"
                                                value={policies.retention_size_mb || ""}
                                                onChange={(e) => handleChange(
                                                    "retention_size_mb",
                                                    e.target.value ? parseInt(e.target.value) : undefined
                                                )}
                                                hint="MB to retain (0 = unlimited)"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </FormSection>

                                {/* TTL */}
                                <FormSection
                                    title="Message TTL"
                                    description="Time-to-live for unacknowledged messages"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-orange-500/10 rounded-lg mt-1">
                                            <Clock size={18} className="text-orange-400" />
                                        </div>
                                        <div className="flex-1">
                                            <FormField
                                                label="TTL (seconds)"
                                                type="number"
                                                value={policies.message_ttl_seconds || ""}
                                                onChange={(e) => handleChange(
                                                    "message_ttl_seconds",
                                                    e.target.value ? parseInt(e.target.value) : undefined
                                                )}
                                                hint="Seconds before unacked messages expire (0 = disabled)"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Deduplication */}
                                <FormSection
                                    title="Deduplication"
                                    description="Prevent duplicate message delivery"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                                            <Shield size={18} className="text-green-400" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={policies.deduplication_enabled || false}
                                                    onChange={(e) => handleChange(
                                                        "deduplication_enabled",
                                                        e.target.checked
                                                    )}
                                                    className="w-5 h-5 rounded border-white/20 bg-white/5 checked:bg-primary"
                                                />
                                                <div>
                                                    <span className="font-medium">Enable Deduplication</span>
                                                    <p className="text-sm text-muted-foreground">
                                                        Automatically deduplicate messages based on producer sequence ID
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Schema Compatibility */}
                                <FormSection
                                    title="Schema"
                                    description="Schema compatibility settings"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-purple-500/10 rounded-lg mt-1">
                                            <Database size={18} className="text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <FormField
                                                as="select"
                                                label="Compatibility Strategy"
                                                value={policies.schema_compatibility_strategy || "FULL"}
                                                onChange={(e) => handleChange(
                                                    "schema_compatibility_strategy",
                                                    e.target.value
                                                )}
                                                options={[
                                                    { value: "FULL", label: "Full" },
                                                    { value: "BACKWARD", label: "Backward" },
                                                    { value: "FORWARD", label: "Forward" },
                                                    { value: "NONE", label: "None" },
                                                    { value: "BACKWARD_TRANSITIVE", label: "Backward Transitive" },
                                                    { value: "FORWARD_TRANSITIVE", label: "Forward Transitive" },
                                                    { value: "FULL_TRANSITIVE", label: "Full Transitive" },
                                                ]}
                                                hint="Determines how schema changes are validated"
                                            />
                                        </div>
                                    </div>
                                </FormSection>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="px-4 py-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={updatePolicies.isPending}
                                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    <Save size={18} />
                                    {updatePolicies.isPending ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
