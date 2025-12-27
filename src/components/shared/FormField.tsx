import { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface FormFieldBaseProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    success?: boolean;
    className?: string;
    labelClassName?: string;
    children?: ReactNode;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FormFieldBaseProps {
    as?: "input";
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FormFieldBaseProps {
    as: "textarea";
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement>, FormFieldBaseProps {
    as: "select";
    options: { value: string; label: string }[];
}

type FormFieldProps = InputProps | TextareaProps | SelectProps;

const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FormFieldProps>(
    (props, ref) => {
        const generatedId = useId();

        const {
            label,
            error,
            hint,
            required,
            success,
            className,
            labelClassName,
            as = "input",
            id = generatedId,
            ...inputProps
        } = props;

        const inputId = id;
        const errorId = `${inputId}-error`;
        const hintId = `${inputId}-hint`;

        const hasError = Boolean(error);
        const hasHint = Boolean(hint);

        const baseInputClasses = cn(
            "w-full px-4 py-2 bg-white/5 border rounded-lg transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "placeholder:text-muted-foreground/50",
            hasError
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                : success
                    ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                    : "border-white/10 focus:border-primary focus:ring-primary/20",
            inputProps.disabled && "opacity-50 cursor-not-allowed"
        );

        const renderInput = () => {
            const ariaProps = {
                "aria-invalid": hasError,
                "aria-describedby": cn(
                    hasError && errorId,
                    hasHint && hintId
                ) || undefined,
                "aria-required": required,
            };

            if (as === "textarea") {
                const { as: _, options, ...textareaProps } = props as TextareaProps & { options?: unknown };
                return (
                    <textarea
                        ref={ref as React.Ref<HTMLTextAreaElement>}
                        id={inputId}
                        className={cn(baseInputClasses, "min-h-[100px] resize-y")}
                        {...ariaProps}
                        {...textareaProps}
                    />
                );
            }

            if (as === "select") {
                const { as: _, options, ...selectProps } = props as SelectProps;
                return (
                    <select
                        ref={ref as React.Ref<HTMLSelectElement>}
                        id={inputId}
                        className={cn(baseInputClasses, "cursor-pointer")}
                        {...ariaProps}
                        {...selectProps}
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value} className="bg-gray-900">
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            }

            const { as: _, options, ...inputOnlyProps } = props as InputProps & { options?: unknown };
            return (
                <input
                    ref={ref as React.Ref<HTMLInputElement>}
                    id={inputId}
                    className={baseInputClasses}
                    {...ariaProps}
                    {...inputOnlyProps}
                />
            );
        };

        return (
            <div className={cn("space-y-2", className)}>
                <label
                    htmlFor={inputId}
                    className={cn(
                        "block text-sm font-medium",
                        hasError ? "text-red-400" : "text-foreground",
                        labelClassName
                    )}
                >
                    {label}
                    {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
                </label>

                <div className="relative">
                    {renderInput()}
                    {(hasError || success) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {hasError ? (
                                <AlertCircle size={18} className="text-red-400" />
                            ) : (
                                <CheckCircle size={18} className="text-green-400" />
                            )}
                        </div>
                    )}
                </div>

                {hasError && (
                    <p
                        id={errorId}
                        className="flex items-center gap-1 text-sm text-red-400"
                        role="alert"
                    >
                        <AlertCircle size={14} />
                        {error}
                    </p>
                )}

                {hasHint && !hasError && (
                    <p
                        id={hintId}
                        className="flex items-center gap-1 text-sm text-muted-foreground"
                    >
                        <Info size={14} />
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

FormField.displayName = "FormField";

export default FormField;

// Convenience wrapper for form groups
export function FormGroup({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("space-y-4", className)}>
            {children}
        </div>
    );
}

// Form section with title
export function FormSection({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("space-y-4", className)}>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}
