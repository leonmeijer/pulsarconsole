import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useApiTokens,
  useTokenStats,
  useCreateApiToken,
  useRevokeApiToken,
  useRevokeAllApiTokens,
  usePulsarTokenCapability,
  useGeneratePulsarToken,
} from '@/api/hooks';
import type { ApiToken } from '@/api/types';
import { ConfirmDialog } from '@/components/shared';

interface CreateTokenFormData {
  name: string;
  expiresInDays: number | null;
  scopes: string[];
}

interface PulsarTokenFormData {
  subject: string;
  expiresInDays: number | null;
}

export default function TokensPage() {
  const { data: tokens, isLoading: tokensLoading } = useApiTokens();
  const { data: stats } = useTokenStats();
  const { data: pulsarCapability } = usePulsarTokenCapability();
  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();
  const revokeAllTokens = useRevokeAllApiTokens();
  const generatePulsarToken = useGeneratePulsarToken();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPulsarForm, setShowPulsarForm] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newPulsarToken, setNewPulsarToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [pulsarTokenCopied, setPulsarTokenCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPulsarTokenValue, setShowPulsarTokenValue] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);

  const [formData, setFormData] = useState<CreateTokenFormData>({
    name: '',
    expiresInDays: 90,
    scopes: [],
  });

  const [pulsarFormData, setPulsarFormData] = useState<PulsarTokenFormData>({
    subject: '',
    expiresInDays: 365,
  });

  const handleCreateToken = async () => {
    if (!formData.name.trim()) {
      toast.error('Token name is required');
      return;
    }

    try {
      const result = await createToken.mutateAsync({
        name: formData.name,
        expiresInDays: formData.expiresInDays || undefined,
        scopes: formData.scopes.length > 0 ? formData.scopes : undefined,
      });
      setNewToken(result.token);
      setFormData({ name: '', expiresInDays: 90, scopes: [] });
      toast.success('API token created successfully');
    } catch {
      toast.error('Failed to create API token');
    }
  };

  const handleGeneratePulsarToken = async () => {
    if (!pulsarFormData.subject.trim()) {
      toast.error('Subject is required');
      return;
    }

    try {
      const result = await generatePulsarToken.mutateAsync({
        subject: pulsarFormData.subject,
        expiresInDays: pulsarFormData.expiresInDays || undefined,
      });
      setNewPulsarToken(result.token);
      setPulsarFormData({ subject: '', expiresInDays: 365 });
      toast.success('Pulsar token generated successfully');
    } catch {
      toast.error('Failed to generate Pulsar token');
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      await revokeToken.mutateAsync(tokenId);
      toast.success('Token revoked');
      setRevokeConfirm(null);
    } catch {
      toast.error('Failed to revoke token');
    }
  };

  const handleRevokeAllTokens = async () => {
    try {
      await revokeAllTokens.mutateAsync();
      toast.success('All tokens revoked');
      setRevokeAllConfirm(false);
    } catch {
      toast.error('Failed to revoke tokens');
    }
  };

  const copyToClipboard = (text: string, type: 'api' | 'pulsar') => {
    navigator.clipboard.writeText(text);
    if (type === 'api') {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } else {
      setPulsarTokenCopied(true);
      setTimeout(() => setPulsarTokenCopied(false), 2000);
    }
    toast.success('Token copied to clipboard');
  };

  const getTokenStatus = (token: ApiToken) => {
    if (token.is_revoked) return { label: 'Revoked', color: 'text-destructive', bg: 'bg-destructive/10' };
    if (token.is_expired) return { label: 'Expired', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    return { label: 'Active', color: 'text-green-500', bg: 'bg-green-500/10' };
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Key className="text-primary" />
            API Tokens
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Console API tokens and generate Pulsar JWT tokens
          </p>
        </div>
        <div className="flex gap-3">
          {pulsarCapability?.can_generate && (
            <button
              onClick={() => setShowPulsarForm(true)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors flex items-center gap-2"
            >
              <Shield size={18} />
              Generate Pulsar Token
            </button>
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Create API Token
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Tokens</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-yellow-500">{stats.expired}</div>
            <div className="text-sm text-muted-foreground">Expired</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-destructive">{stats.revoked}</div>
            <div className="text-sm text-muted-foreground">Revoked</div>
          </div>
        </div>
      )}

      {/* New Token Display */}
      <AnimatePresence>
        {newToken && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-xl p-6 border border-green-500/20 bg-green-500/5"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">API Token Created</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Make sure to copy your token now. You won't be able to see it again!
                </p>
                <div className="flex items-center gap-2 bg-black/20 rounded-lg p-3 font-mono text-sm">
                  <span className="flex-1 break-all">
                    {showToken ? newToken : '•'.repeat(40)}
                  </span>
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(newToken, 'api')}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {tokenCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewToken(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Pulsar Token Display */}
      <AnimatePresence>
        {newPulsarToken && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-xl p-6 border border-secondary/20 bg-secondary/5"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-secondary/10">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Pulsar JWT Token Generated</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Copy this token for use with Apache Pulsar. It won't be stored or shown again!
                </p>
                <div className="flex items-center gap-2 bg-black/20 rounded-lg p-3 font-mono text-sm">
                  <span className="flex-1 break-all">
                    {showPulsarTokenValue ? newPulsarToken : '•'.repeat(40)}
                  </span>
                  <button
                    onClick={() => setShowPulsarTokenValue(!showPulsarTokenValue)}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {showPulsarTokenValue ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(newPulsarToken, 'pulsar')}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {pulsarTokenCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewPulsarToken(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token List */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold">Your API Tokens</h2>
          {tokens && tokens.length > 0 && (
            <button
              onClick={() => setRevokeAllConfirm(true)}
              className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <Trash2 size={14} />
              Revoke All
            </button>
          )}
        </div>

        {tokensLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tokens && tokens.length > 0 ? (
          <div className="divide-y divide-white/10">
            {tokens.map((token) => {
              const status = getTokenStatus(token);
              return (
                <div key={token.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Key className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono">{token.token_prefix}...</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Created {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
                        </span>
                        {token.expires_at && (
                          <span>
                            Expires {format(new Date(token.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                        {token.last_used_at && (
                          <span>
                            Last used {formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    {!token.is_revoked && (
                      <button
                        onClick={() => setRevokeConfirm(token.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Revoke token"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Key className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No API tokens yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Create a token to access the API programmatically
            </p>
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-xl p-6 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">Create API Token</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Token Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CI/CD Pipeline"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Expiration</label>
                  <select
                    value={formData.expiresInDays?.toString() || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      expiresInDays: e.target.value ? parseInt(e.target.value) : null,
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="">Never expires</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateToken}
                    disabled={createToken.isPending}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createToken.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                    Create Token
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Pulsar Token Modal */}
      <AnimatePresence>
        {showPulsarForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPulsarForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-xl p-6 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="text-secondary" />
                Generate Pulsar JWT Token
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Generate a JWT token for authenticating with Apache Pulsar.
                {pulsarCapability?.environment_name && (
                  <span className="block mt-1">
                    Environment: <strong>{pulsarCapability.environment_name}</strong>
                  </span>
                )}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Subject (Principal)</label>
                  <input
                    type="text"
                    value={pulsarFormData.subject}
                    onChange={(e) => setPulsarFormData({ ...pulsarFormData, subject: e.target.value })}
                    placeholder="e.g., admin or client-app"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be the identity used for Pulsar authorization
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Expiration</label>
                  <select
                    value={pulsarFormData.expiresInDays?.toString() || ''}
                    onChange={(e) => setPulsarFormData({
                      ...pulsarFormData,
                      expiresInDays: e.target.value ? parseInt(e.target.value) : null,
                    })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                    <option value="">Never expires</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowPulsarForm(false)}
                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGeneratePulsarToken}
                    disabled={generatePulsarToken.isPending}
                    className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generatePulsarToken.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw size={18} />
                    )}
                    Generate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeConfirm}
        onOpenChange={(open) => !open && setRevokeConfirm(null)}
        title="Revoke Token"
        description="Are you sure you want to revoke this token? This action cannot be undone and any applications using this token will lose access."
        confirmLabel="Revoke"
        onConfirm={async () => { if (revokeConfirm) await handleRevokeToken(revokeConfirm); }}
        variant="danger"
      />

      {/* Revoke All Confirmation */}
      <ConfirmDialog
        open={revokeAllConfirm}
        onOpenChange={setRevokeAllConfirm}
        title="Revoke All Tokens"
        description="Are you sure you want to revoke ALL tokens? This action cannot be undone and all applications using these tokens will lose access."
        confirmLabel="Revoke All"
        onConfirm={handleRevokeAllTokens}
        variant="danger"
      />
    </div>
  );
}
