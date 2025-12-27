import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { usePendingUsersCount } from '@/api/hooks';

const SESSION_TOAST_KEY = 'pending_users_toast_shown';

export default function AuthEventListener() {
  const navigate = useNavigate();
  const { authRequired, isAuthenticated, user } = useAuth();
  const { count: pendingUsersCount, isLoading } = usePendingUsersCount();
  const hasShownToast = useRef(false);

  // Check if current user is a superuser
  const isSuperuser = user?.roles?.some(role => role.name === 'superuser') ?? false;

  useEffect(() => {
    const handleLogout = () => {
      if (authRequired) {
        toast.error('Session expired. Please log in again.');
        navigate('/login', { replace: true });
      }
      // Clear the toast flag on logout so it shows again on next login
      sessionStorage.removeItem(SESSION_TOAST_KEY);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [navigate, authRequired]);

  // Show toast for superusers when there are pending users
  useEffect(() => {
    // Only show once per session
    if (hasShownToast.current) return;
    if (sessionStorage.getItem(SESSION_TOAST_KEY)) return;

    // Wait for data to load
    if (isLoading) return;

    // Only for authenticated superusers
    if (!isAuthenticated || !isSuperuser) return;

    // Only if there are pending users
    if (pendingUsersCount === 0) return;

    // Mark as shown
    hasShownToast.current = true;
    sessionStorage.setItem(SESSION_TOAST_KEY, 'true');

    // Show toast with action to go to users page
    toast.warning(
      `${pendingUsersCount} user${pendingUsersCount > 1 ? 's' : ''} awaiting role assignment`,
      {
        description: 'Click to review and assign roles',
        duration: 8000,
        action: {
          label: 'Review',
          onClick: () => navigate('/settings/users'),
        },
      }
    );
  }, [isAuthenticated, isSuperuser, pendingUsersCount, isLoading, navigate]);

  return null;
}
