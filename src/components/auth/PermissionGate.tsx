import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield } from 'lucide-react';

interface PermissionGateProps {
  children: ReactNode;
  action: string;
  resourceLevel: string;
  resourcePath?: string;
  fallback?: ReactNode;
  showDenied?: boolean;
}

export default function PermissionGate({
  children,
  action,
  resourceLevel,
  resourcePath,
  fallback = null,
  showDenied = false,
}: PermissionGateProps) {
  const { isAuthenticated, authRequired, checkPermission } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      // If auth not required, allow everything
      if (!authRequired) {
        if (isMounted) setHasPermission(true);
        return;
      }

      // If not authenticated, deny
      if (!isAuthenticated) {
        if (isMounted) setHasPermission(false);
        return;
      }

      // Check permission via API (handles superuser role check on backend)
      const allowed = await checkPermission(action, resourceLevel, resourcePath);
      if (isMounted) setHasPermission(allowed);
    };

    check();

    return () => {
      isMounted = false;
    };
  }, [action, resourceLevel, resourcePath, isAuthenticated, authRequired, checkPermission]);

  // Still loading permission state
  if (hasPermission === null) {
    return null;
  }

  // Has permission
  if (hasPermission) {
    return <>{children}</>;
  }

  // No permission - show denied message if requested
  if (showDenied) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="p-4 rounded-full bg-destructive/10 mb-4">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          You don't have permission to perform this action. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  // Return fallback or nothing
  return <>{fallback}</>;
}

// Hook version for more complex use cases
export function usePermission(
  action: string,
  resourceLevel: string,
  resourcePath?: string
): { hasPermission: boolean | null; isLoading: boolean } {
  const { isAuthenticated, authRequired, checkPermission } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      setIsLoading(true);

      // If auth not required, allow everything
      if (!authRequired) {
        if (isMounted) {
          setHasPermission(true);
          setIsLoading(false);
        }
        return;
      }

      // If not authenticated, deny
      if (!isAuthenticated) {
        if (isMounted) {
          setHasPermission(false);
          setIsLoading(false);
        }
        return;
      }

      // Check permission via API (handles superuser role check on backend)
      const allowed = await checkPermission(action, resourceLevel, resourcePath);
      if (isMounted) {
        setHasPermission(allowed);
        setIsLoading(false);
      }
    };

    check();

    return () => {
      isMounted = false;
    };
  }, [action, resourceLevel, resourcePath, isAuthenticated, authRequired, checkPermission]);

  return { hasPermission, isLoading };
}

// Higher-order component version
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  action: string,
  resourceLevel: string,
  resourcePath?: string
) {
  return function WithPermissionComponent(props: P) {
    return (
      <PermissionGate action={action} resourceLevel={resourceLevel} resourcePath={resourcePath}>
        <WrappedComponent {...props} />
      </PermissionGate>
    );
  };
}
