import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function AuthEventListener() {
  const navigate = useNavigate();
  const { authRequired } = useAuth();

  useEffect(() => {
    const handleLogout = () => {
      if (authRequired) {
        toast.error('Session expired. Please log in again.');
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [navigate, authRequired]);

  return null;
}
