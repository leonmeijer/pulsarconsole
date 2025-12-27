import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Shield, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, authRequired, providers, login, handleCallback } = useAuth();

  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the redirect destination
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Check for OAuth callback parameters
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    if (code && state) {
      setIsLoggingIn(true);
      handleCallback(code, state)
        .then(() => {
          toast.success('Login successful');
          navigate(from, { replace: true });
        })
        .catch((err) => {
          setError(err.message || 'Authentication failed');
          setIsLoggingIn(false);
        });
    }
  }, [searchParams, handleCallback, navigate, from]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoggingIn) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoggingIn, navigate, from]);

  // If auth is not required, redirect to home
  useEffect(() => {
    if (!isLoading && !authRequired) {
      navigate('/', { replace: true });
    }
  }, [isLoading, authRequired, navigate]);

  const handleLogin = async (providerId?: string) => {
    const provider = providerId || selectedProvider;
    if (!provider) {
      toast.error('Please select a provider');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}/login`;
      const authUrl = await login(provider, redirectUri);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
      setIsLoggingIn(false);
    }
  };

  const handleProviderDoubleClick = (providerId: string) => {
    if (isLoggingIn) return;
    setSelectedProvider(providerId);
    handleLogin(providerId);
  };

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8 border border-white/10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to Pulsar Console</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Authentication Error</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Provider Selection */}
          {providers.length > 0 ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium mb-2">
                Select Identity Provider
              </label>

              <div className="space-y-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    onDoubleClick={() => handleProviderDoubleClick(provider.id)}
                    disabled={isLoggingIn}
                    className={`w-full p-4 rounded-lg border transition-all text-left flex items-center gap-3 ${
                      selectedProvider === provider.id
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    } ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{provider.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {provider.issuer_url}
                      </p>
                    </div>
                    {selectedProvider === provider.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleLogin()}
                disabled={!selectedProvider || isLoggingIn}
                className="w-full mt-6 py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign in with SSO
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No identity providers configured</p>
              <p className="text-sm text-muted-foreground/70">
                Please contact your administrator to configure authentication.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-muted-foreground">
              Protected by Pulsar Console Authentication
            </p>
            {providers.length > 0 && (
              <a
                href={providers[0]?.issuer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View Identity Provider
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Pulsar Console Branding */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Pulsar Console
          </p>
        </div>
      </motion.div>
    </div>
  );
}
