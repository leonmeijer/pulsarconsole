import { Shield, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PendingAccessProps {
  onRetry?: () => void;
}

export default function PendingAccess({ onRetry }: PendingAccessProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="glass p-8 rounded-2xl max-w-md w-full text-center">
        <div className="p-4 rounded-full bg-amber-500/10 inline-block mb-6">
          <Shield className="w-12 h-12 text-amber-500" />
        </div>

        <h2 className="text-2xl font-bold mb-3">Access Pending</h2>

        <p className="text-muted-foreground mb-6">
          Welcome, <span className="font-medium text-foreground">{user?.display_name || user?.email}</span>!
          Your account has been created, but you don't have any permissions yet.
        </p>

        <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium mb-2 text-sm">What happens next?</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span>An administrator will review your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span>They will assign you an appropriate role</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span>Once assigned, refresh this page to access the console</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={18} />
              Check Again
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}
