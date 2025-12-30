import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Settings,
  Key,
  Shield,
  ChevronDown,
  Users,
  FileKey,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, authRequired, logout } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Failed to logout');
    }
    setIsOpen(false);
  };

  // If auth is not required, show simple user icon
  if (!authRequired) {
    return (
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all">
        <User size={20} className="text-white" />
      </div>
    );
  }

  // If not authenticated, show login button
  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
      >
        <User size={18} />
        <span className="text-sm font-medium">Login</span>
      </Link>
    );
  }

  // Get initials from display name or email
  const getInitials = () => {
    if (user?.display_name) {
      return user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-colors group"
      >
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name || user.email}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-sm font-bold text-white">{getInitials()}</span>
          </div>
        )}
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 glass">
          {/* User Info */}
          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || user.email}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{getInitials()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-popover-foreground">
                  {user?.display_name || 'User'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </p>
                {(user?.is_global_admin || user?.roles?.some((role) => role.name === 'superuser')) && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                    <Shield size={10} />
                    Superuser
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              to="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-white/5 transition-colors"
            >
              <Settings size={18} className="text-muted-foreground" />
              <span>Settings</span>
            </Link>
            <Link
              to="/settings/tokens"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-white/5 transition-colors"
            >
              <Key size={18} className="text-muted-foreground" />
              <span>API Tokens</span>
            </Link>
            <Link
              to="/settings/sessions"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-white/5 transition-colors"
            >
              <FileKey size={18} className="text-muted-foreground" />
              <span>Sessions</span>
            </Link>
            {user?.roles?.some((role) => role.name === 'superuser') && (
              <>
                <div className="h-px bg-white/10 my-2" />
                <Link
                  to="/settings/users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-white/5 transition-colors"
                >
                  <Users size={18} className="text-muted-foreground" />
                  <span>User Management</span>
                </Link>
                <Link
                  to="/settings/roles"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-white/5 transition-colors"
                >
                  <Shield size={18} className="text-muted-foreground" />
                  <span>Roles & Permissions</span>
                </Link>
              </>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
