import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
    variant?: "default" | "danger" | "warning" | "success";
    loading?: boolean;
}

const variantConfig = {
    default: {
        icon: Info,
        iconClass: "bg-primary/10 text-primary",
        buttonClass: "bg-primary hover:bg-primary/90",
    },
    danger: {
        icon: AlertTriangle,
        iconClass: "bg-red-500/10 text-red-500",
        buttonClass: "bg-red-500 hover:bg-red-600",
    },
    warning: {
        icon: AlertTriangle,
        iconClass: "bg-yellow-500/10 text-yellow-500",
        buttonClass: "bg-yellow-500 hover:bg-yellow-600",
    },
    success: {
        icon: CheckCircle,
        iconClass: "bg-green-500/10 text-green-500",
        buttonClass: "bg-green-500 hover:bg-green-600",
    },
};

export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    variant = "default",
    loading = false,
}: ConfirmDialogProps) {
    const config = variantConfig[variant];
    const Icon = config.icon;

    const handleConfirm = async () => {
        await onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            />
                        </Dialog.Overlay>
                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md glass rounded-2xl p-6 shadow-xl"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn("p-3 rounded-xl", config.iconClass)}>
                                        <Icon size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <Dialog.Title className="text-lg font-semibold">
                                            {title}
                                        </Dialog.Title>
                                        <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                                            {description}
                                        </Dialog.Description>
                                    </div>
                                    <Dialog.Close asChild>
                                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                            <X size={18} className="text-muted-foreground" />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <Dialog.Close asChild>
                                        <button
                                            className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors font-medium"
                                            disabled={loading}
                                        >
                                            {cancelLabel}
                                        </button>
                                    </Dialog.Close>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading}
                                        className={cn(
                                            "px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50",
                                            config.buttonClass
                                        )}
                                    >
                                        {loading ? "Loading..." : confirmLabel}
                                    </button>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
}
