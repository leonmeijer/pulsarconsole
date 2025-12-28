import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Lock,
  LockOpen,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PulsarAuthStatus, PulsarAuthValidation } from '@/api/hooks';

/**
 * Format a Java class name to a more readable short name.
 * e.g., "org.apache.pulsar.broker.authorization.PulsarAuthorizationProvider" -> "Pulsar Authorization"
 */
function formatProviderName(fullClassName: string): string {
  // Extract the simple class name (last part after the last dot)
  const simpleName = fullClassName.split('.').pop() || fullClassName;
  
  // Remove common suffixes and format
  return simpleName
    .replace(/Provider$/, '')
    .replace(/Authorization$/, ' Authorization')
    .replace(/Authentication$/, ' Authentication')
    // Add spaces before capital letters (camelCase to Title Case)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

/**
 * Filter out warnings that are actually positive status messages.
 */
function filterRealWarnings(warnings: string[], authEnabled: boolean): string[] {
  return warnings.filter(warning => {
    // "Authentication is already enabled" is not a warning when auth is enabled - it's good!
    if (authEnabled && warning.toLowerCase().includes('authentication is already enabled')) {
      return false;
    }
    return true;
  });
}

interface AuthStatusCardProps {
  status: PulsarAuthStatus | undefined;
  validation: PulsarAuthValidation | undefined;
  isLoading: boolean;
  isValidating: boolean;
}

export default function AuthStatusCard({
  status,
  validation,
  isLoading,
  isValidating,
}: AuthStatusCardProps) {
  if (isLoading) {
    return (
      <div className="glass rounded-xl p-6 border border-white/10 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-10 bg-white/10 rounded w-1/2 mb-4" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  const authEnabled = status?.authentication_enabled ?? false;
  const authzEnabled = status?.authorization_enabled ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl border border-white/10 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'p-3 rounded-xl',
              authEnabled ? 'bg-green-500/10' : 'bg-yellow-500/10'
            )}
          >
            {authEnabled ? (
              <ShieldCheck className="w-8 h-8 text-green-500" />
            ) : (
              <ShieldX className="w-8 h-8 text-yellow-500" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pulsar Authentication</h2>
            <p className="text-muted-foreground">
              {authEnabled
                ? 'Authentication is enabled on this cluster'
                : 'Authentication is disabled on this cluster'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Authentication Status */}
        <div className="p-4 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            {authEnabled ? (
              <Lock className="w-5 h-5 text-green-500" />
            ) : (
              <LockOpen className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <p className="font-medium">Authentication</p>
              <p
                className={cn(
                  'text-sm',
                  authEnabled ? 'text-green-500' : 'text-yellow-500'
                )}
              >
                {authEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Authorization Status */}
        <div className="p-4 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            {authzEnabled ? (
              <Shield className="w-5 h-5 text-green-500" />
            ) : (
              <Shield className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Authorization</p>
              <p
                className={cn(
                  'text-sm',
                  authzEnabled ? 'text-green-500' : 'text-muted-foreground'
                )}
              >
                {authzEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Auth Provider */}
        {status?.authorization_provider && (
          <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-muted-foreground">Auth Provider</p>
            <p className="font-medium text-sm break-all" title={status.authorization_provider}>
              {formatProviderName(status.authorization_provider)}
            </p>
          </div>
        )}

        {/* Superuser Roles */}
        {status?.super_user_roles && status.super_user_roles.length > 0 && (
          <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-muted-foreground">Superuser Roles</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {status.super_user_roles.map((role: string) => (
                <span
                  key={role}
                  className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Validation Section */}
      {validation && (
        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-medium">Pre-flight Validation</h3>
            {isValidating && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>

          <div className="space-y-3">
            {/* Valid Token */}
            <div className="flex items-center gap-3">
              {validation.has_valid_token ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                {validation.has_valid_token
                  ? 'Superuser token is valid'
                  : 'No valid superuser token configured'}
              </span>
            </div>

            {/* Superuser Roles Configured */}
            <div className="flex items-center gap-3">
              {validation.superuser_roles_configured ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm">
                {validation.superuser_roles_configured
                  ? 'Superuser roles are configured'
                  : 'No superuser roles configured'}
              </span>
            </div>

            {/* Can Enable Auth */}
            <div className="flex items-center gap-3">
              {validation.can_enable_auth ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                {validation.can_enable_auth
                  ? 'Ready to enable authentication'
                  : 'Cannot enable authentication'}
              </span>
            </div>

            {/* Warnings - filtered to remove positive status messages */}
            {(() => {
              const realWarnings = filterRealWarnings(validation.warnings || [], authEnabled);
              return realWarnings.length > 0 ? (
                <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-500 mb-2">
                    <AlertTriangle size={16} />
                    <span className="font-medium text-sm">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {realWarnings.map((warning, i) => (
                      <li key={i} className="text-sm text-yellow-400">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            {/* Errors */}
            {validation.errors && validation.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <XCircle size={16} />
                  <span className="font-medium text-sm">Errors</span>
                </div>
                <ul className="space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-400">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
