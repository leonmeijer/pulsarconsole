import { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Globe,
  Trash2,
  Loader2,
  Clock,
  MapPin,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from '@/api/hooks';
import type { SessionInfo } from '@/api/types';
import { ConfirmDialog } from '@/components/shared';

function parseUserAgent(userAgent: string | null): { device: string; browser: string; icon: typeof Monitor } {
  if (!userAgent) {
    return { device: 'Unknown Device', browser: 'Unknown Browser', icon: Globe };
  }

  const ua = userAgent.toLowerCase();

  // Device detection
  let device = 'Desktop';
  let icon = Monitor;
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
    icon = Smartphone;
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
    icon = Smartphone;
  }

  // Browser detection
  let browser = 'Unknown Browser';
  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  }

  // OS detection
  let os = '';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }

  return {
    device: os ? `${device} (${os})` : device,
    browser,
    icon,
  };
}

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();

  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession.mutateAsync(sessionId);
      toast.success('Session revoked');
      setRevokeConfirm(null);
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions.mutateAsync();
      toast.success('All other sessions revoked');
      setRevokeAllConfirm(false);
    } catch {
      toast.error('Failed to revoke sessions');
    }
  };

  const currentSession = sessions?.find((s) => s.is_current);
  const otherSessions = sessions?.filter((s) => !s.is_current) || [];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="text-primary" />
            Active Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your active login sessions across devices
          </p>
        </div>
        {otherSessions.length > 0 && (
          <button
            onClick={() => setRevokeAllConfirm(true)}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} />
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {/* Current Session */}
      {currentSession && (
        <div className="glass rounded-xl border border-green-500/20 bg-green-500/5 overflow-hidden">
          <div className="p-4 border-b border-green-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium text-green-500">Current Session</span>
          </div>
          <SessionCard session={currentSession} isCurrent />
        </div>
      )}

      {/* Other Sessions */}
      {isLoading ? (
        <div className="glass rounded-xl p-8 flex items-center justify-center border border-white/10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : otherSessions.length > 0 ? (
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold">Other Sessions ({otherSessions.length})</h2>
          </div>
          <div className="divide-y divide-white/10">
            {otherSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={() => setRevokeConfirm(session.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-8 text-center border border-white/10">
          <Monitor className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No other active sessions</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            You're only logged in on this device
          </p>
        </div>
      )}

      {/* Security Notice */}
      <div className="glass rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-500">Security Notice</h3>
            <p className="text-sm text-muted-foreground mt-1">
              If you see any sessions you don't recognize, revoke them immediately and
              consider changing your password. Revoking a session will sign out that device.
            </p>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeConfirm}
        onOpenChange={(open) => !open && setRevokeConfirm(null)}
        title="Revoke Session"
        description="Are you sure you want to revoke this session? The device will be signed out immediately."
        confirmLabel="Revoke"
        onConfirm={async () => { if (revokeConfirm) await handleRevokeSession(revokeConfirm); }}
        variant="danger"
      />

      {/* Revoke All Confirmation */}
      <ConfirmDialog
        open={revokeAllConfirm}
        onOpenChange={setRevokeAllConfirm}
        title="Revoke All Other Sessions"
        description="Are you sure you want to revoke all other sessions? All devices except this one will be signed out immediately."
        confirmLabel="Revoke All"
        onConfirm={handleRevokeAllSessions}
        variant="danger"
      />
    </div>
  );
}

interface SessionCardProps {
  session: SessionInfo;
  isCurrent?: boolean;
  onRevoke?: () => void;
}

function SessionCard({ session, isCurrent, onRevoke }: SessionCardProps) {
  const { device, browser, icon: DeviceIcon } = parseUserAgent(session.user_agent);
  const isExpiringSoon = new Date(session.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div className="p-4 hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-white/5">
          <DeviceIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{browser}</span>
            <span className="text-muted-foreground">on</span>
            <span className="font-medium">{device}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {session.ip_address && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {session.ip_address}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Started {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
            </span>
            <span className={isExpiringSoon ? 'text-yellow-500' : ''}>
              Expires {format(new Date(session.expires_at), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
        </div>
        {!isCurrent && onRevoke && (
          <button
            onClick={onRevoke}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Revoke session"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
