import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Trash2,
  Mail,
  Webhook,
  Check,
  Loader2,
  Edit2,
  Send,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotificationChannels,
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
} from '@/api/hooks';
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationChannelCreate,
  EmailConfig,
  SlackConfig,
  WebhookConfig,
  NotificationSeverity,
  NotificationType,
} from '@/api/types';
import { ConfirmDialog } from '@/components/shared';

// Slack icon component
const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const CHANNEL_TYPES: { value: NotificationChannelType; label: string; icon: React.ReactNode }[] = [
  { value: 'email', label: 'Email', icon: <Mail size={18} /> },
  { value: 'slack', label: 'Slack', icon: <SlackIcon className="w-[18px] h-[18px]" /> },
  { value: 'webhook', label: 'Webhook', icon: <Webhook size={18} /> },
];

const SEVERITY_OPTIONS: NotificationSeverity[] = ['info', 'warning', 'critical'];
const TYPE_OPTIONS: NotificationType[] = [
  'consumer_disconnect',
  'broker_health',
  'storage_warning',
  'backlog_warning',
  'error',
  'info',
];

interface ChannelFormData {
  name: string;
  channel_type: NotificationChannelType;
  is_enabled: boolean;
  severity_filter: NotificationSeverity[] | null;
  type_filter: NotificationType[] | null;
  // Email config
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  from_address: string;
  from_name: string;
  recipients: string;
  // Slack config
  webhook_url: string;
  slack_channel: string;
  slack_username: string;
  icon_emoji: string;
  // Webhook config
  url: string;
  method: 'POST' | 'PUT';
  headers: string;
  include_metadata: boolean;
  timeout_seconds: number;
}

const defaultFormData: ChannelFormData = {
  name: '',
  channel_type: 'email',
  is_enabled: true,
  severity_filter: null,
  type_filter: null,
  // Email
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  smtp_use_tls: true,
  from_address: '',
  from_name: 'Pulsar Console',
  recipients: '',
  // Slack
  webhook_url: '',
  slack_channel: '',
  slack_username: 'Pulsar Console',
  icon_emoji: ':bell:',
  // Webhook
  url: '',
  method: 'POST',
  headers: '',
  include_metadata: true,
  timeout_seconds: 30,
};

function getChannelIcon(type: NotificationChannelType) {
  switch (type) {
    case 'email':
      return <Mail className="w-5 h-5 text-blue-400" />;
    case 'slack':
      return <SlackIcon className="w-5 h-5 text-purple-400" />;
    case 'webhook':
      return <Webhook className="w-5 h-5 text-orange-400" />;
  }
}

function getConfigSummary(channel: NotificationChannel): string {
  const config = channel.config;
  switch (channel.channel_type) {
    case 'email':
      return `${(config.recipients as string[])?.length || 0} recipient(s) via ${config.smtp_host || 'SMTP'}`;
    case 'slack':
      return config.channel ? `#${config.channel}` : 'Default channel';
    case 'webhook':
      return (config.url as string)?.replace(/^https?:\/\//, '').split('/')[0] || 'Webhook URL';
    default:
      return '';
  }
}

export default function NotificationChannelsPage() {
  const { data: channels, isLoading } = useNotificationChannels();
  const createChannel = useCreateNotificationChannel();
  const updateChannel = useUpdateNotificationChannel();
  const deleteChannel = useDeleteNotificationChannel();
  const testChannel = useTestNotificationChannel();

  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChannelFormData>(defaultFormData);

  const openCreateForm = () => {
    setFormData(defaultFormData);
    setEditingChannel(null);
    setShowForm(true);
  };

  const openEditForm = (channel: NotificationChannel) => {
    const config = channel.config;
    setFormData({
      name: channel.name,
      channel_type: channel.channel_type,
      is_enabled: channel.is_enabled,
      severity_filter: channel.severity_filter,
      type_filter: channel.type_filter,
      // Email
      smtp_host: (config.smtp_host as string) || '',
      smtp_port: (config.smtp_port as number) || 587,
      smtp_user: (config.smtp_user as string) || '',
      smtp_password: '',
      smtp_use_tls: (config.smtp_use_tls as boolean) ?? true,
      from_address: (config.from_address as string) || '',
      from_name: (config.from_name as string) || 'Pulsar Console',
      recipients: ((config.recipients as string[]) || []).join(', '),
      // Slack
      webhook_url: (config.webhook_url as string) || '',
      slack_channel: (config.channel as string) || '',
      slack_username: (config.username as string) || 'Pulsar Console',
      icon_emoji: (config.icon_emoji as string) || ':bell:',
      // Webhook
      url: (config.url as string) || '',
      method: (config.method as 'POST' | 'PUT') || 'POST',
      headers: config.headers ? JSON.stringify(config.headers, null, 2) : '',
      include_metadata: (config.include_metadata as boolean) ?? true,
      timeout_seconds: (config.timeout_seconds as number) || 30,
    });
    setEditingChannel(channel);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    let config: EmailConfig | SlackConfig | WebhookConfig;

    if (formData.channel_type === 'email') {
      if (!formData.smtp_host || !formData.from_address || !formData.recipients) {
        toast.error('SMTP host, from address, and recipients are required');
        return;
      }
      config = {
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_user: formData.smtp_user || undefined,
        smtp_password: formData.smtp_password || undefined,
        smtp_use_tls: formData.smtp_use_tls,
        from_address: formData.from_address,
        from_name: formData.from_name,
        recipients: formData.recipients.split(',').map((r) => r.trim()).filter(Boolean),
      };
    } else if (formData.channel_type === 'slack') {
      if (!formData.webhook_url) {
        toast.error('Slack webhook URL is required');
        return;
      }
      config = {
        webhook_url: formData.webhook_url,
        channel: formData.slack_channel || undefined,
        username: formData.slack_username,
        icon_emoji: formData.icon_emoji,
      };
    } else {
      if (!formData.url) {
        toast.error('Webhook URL is required');
        return;
      }
      let headers: Record<string, string> | undefined;
      if (formData.headers.trim()) {
        try {
          headers = JSON.parse(formData.headers);
        } catch {
          toast.error('Invalid JSON for headers');
          return;
        }
      }
      config = {
        url: formData.url,
        method: formData.method,
        headers,
        include_metadata: formData.include_metadata,
        timeout_seconds: formData.timeout_seconds,
      };
    }

    const channelData: NotificationChannelCreate = {
      name: formData.name,
      channel_type: formData.channel_type,
      is_enabled: formData.is_enabled,
      severity_filter: formData.severity_filter,
      type_filter: formData.type_filter,
      config,
    };

    try {
      if (editingChannel) {
        await updateChannel.mutateAsync({ id: editingChannel.id, data: channelData });
        toast.success('Channel updated successfully');
      } else {
        await createChannel.mutateAsync(channelData);
        toast.success('Channel created successfully');
      }
      setShowForm(false);
      setEditingChannel(null);
      setFormData(defaultFormData);
    } catch {
      toast.error(editingChannel ? 'Failed to update channel' : 'Failed to create channel');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChannel.mutateAsync(id);
      toast.success('Channel deleted');
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete channel');
    }
  };

  const handleTest = async (id: string) => {
    setTestingChannel(id);
    try {
      const result = await testChannel.mutateAsync(id);
      if (result.success) {
        toast.success(`Test successful${result.latency_ms ? ` (${result.latency_ms.toFixed(0)}ms)` : ''}`);
      } else {
        toast.error(result.message || 'Test failed');
      }
    } catch {
      toast.error('Failed to test channel');
    } finally {
      setTestingChannel(null);
    }
  };

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    try {
      await updateChannel.mutateAsync({
        id: channel.id,
        data: { is_enabled: !channel.is_enabled },
      });
      toast.success(channel.is_enabled ? 'Channel disabled' : 'Channel enabled');
    } catch {
      toast.error('Failed to update channel');
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="text-primary" />
            Notification Channels
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure email, Slack, and webhook destinations for alerts
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Channel
        </button>
      </div>

      {/* Channel List */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold">Configured Channels</h2>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="divide-y divide-white/10">
            {channels.map((channel) => (
              <div key={channel.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-white/5">
                    {getChannelIcon(channel.channel_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{channel.name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        channel.is_enabled
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {channel.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-muted-foreground capitalize">
                        {channel.channel_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{getConfigSummary(channel)}</span>
                      {channel.severity_filter && (
                        <span>Severity: {channel.severity_filter.join(', ')}</span>
                      )}
                      <span>
                        Updated {formatDistanceToNow(new Date(channel.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleEnabled(channel)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                      title={channel.is_enabled ? 'Disable' : 'Enable'}
                    >
                      {channel.is_enabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => handleTest(channel.id)}
                      disabled={testingChannel === channel.id}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Send test notification"
                    >
                      {testingChannel === channel.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => openEditForm(channel)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(channel.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No notification channels configured</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add a channel to receive alerts via email, Slack, or webhook
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">
                {editingChannel ? 'Edit Channel' : 'Add Notification Channel'}
              </h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Channel Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Ops Team Email"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Channel Type */}
                {!editingChannel && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Channel Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANNEL_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setFormData({ ...formData, channel_type: type.value })}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                            formData.channel_type === type.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-white/10 hover:bg-white/5'
                          }`}
                        >
                          {type.icon}
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email Config */}
                {formData.channel_type === 'email' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">SMTP Host</label>
                        <input
                          type="text"
                          value={formData.smtp_host}
                          onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                          placeholder="smtp.example.com"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">SMTP Port</label>
                        <input
                          type="number"
                          value={formData.smtp_port}
                          onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">SMTP User</label>
                        <input
                          type="text"
                          value={formData.smtp_user}
                          onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                          placeholder="Optional"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">SMTP Password</label>
                        <input
                          type="password"
                          value={formData.smtp_password}
                          onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                          placeholder={editingChannel ? 'Leave blank to keep' : 'Optional'}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtp_use_tls"
                        checked={formData.smtp_use_tls}
                        onChange={(e) => setFormData({ ...formData, smtp_use_tls: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="smtp_use_tls" className="text-sm">Use TLS/STARTTLS</label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">From Address</label>
                        <input
                          type="email"
                          value={formData.from_address}
                          onChange={(e) => setFormData({ ...formData, from_address: e.target.value })}
                          placeholder="alerts@example.com"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">From Name</label>
                        <input
                          type="text"
                          value={formData.from_name}
                          onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                          placeholder="Pulsar Console"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Recipients</label>
                      <input
                        type="text"
                        value={formData.recipients}
                        onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                        placeholder="admin@example.com, ops@example.com"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Comma-separated email addresses</p>
                    </div>
                  </>
                )}

                {/* Slack Config */}
                {formData.channel_type === 'slack' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Webhook URL</label>
                      <input
                        type="url"
                        value={formData.webhook_url}
                        onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Channel Override</label>
                        <input
                          type="text"
                          value={formData.slack_channel}
                          onChange={(e) => setFormData({ ...formData, slack_channel: e.target.value })}
                          placeholder="#alerts (optional)"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Bot Username</label>
                        <input
                          type="text"
                          value={formData.slack_username}
                          onChange={(e) => setFormData({ ...formData, slack_username: e.target.value })}
                          placeholder="Pulsar Console"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Icon Emoji</label>
                      <input
                        type="text"
                        value={formData.icon_emoji}
                        onChange={(e) => setFormData({ ...formData, icon_emoji: e.target.value })}
                        placeholder=":bell:"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </>
                )}

                {/* Webhook Config */}
                {formData.channel_type === 'webhook' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Webhook URL</label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://api.example.com/webhooks"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">HTTP Method</label>
                        <select
                          value={formData.method}
                          onChange={(e) => setFormData({ ...formData, method: e.target.value as 'POST' | 'PUT' })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Timeout (seconds)</label>
                        <input
                          type="number"
                          value={formData.timeout_seconds}
                          onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) || 30 })}
                          min={5}
                          max={120}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Headers (JSON)</label>
                      <textarea
                        value={formData.headers}
                        onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                        placeholder='{"X-API-Key": "your-key"}'
                        rows={3}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="include_metadata"
                        checked={formData.include_metadata}
                        onChange={(e) => setFormData({ ...formData, include_metadata: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="include_metadata" className="text-sm">Include full notification metadata</label>
                    </div>
                  </>
                )}

                {/* Filters */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="text-sm font-medium mb-3">Filters (Optional)</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-2">Severity Filter</label>
                      <div className="flex flex-wrap gap-2">
                        {SEVERITY_OPTIONS.map((severity) => (
                          <button
                            key={severity}
                            onClick={() => {
                              const current = formData.severity_filter || [];
                              const updated = current.includes(severity)
                                ? current.filter((s) => s !== severity)
                                : [...current, severity];
                              setFormData({ ...formData, severity_filter: updated.length ? updated : null });
                            }}
                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                              formData.severity_filter?.includes(severity)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-white/10 hover:bg-white/5'
                            }`}
                          >
                            {severity}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-2">Type Filter</label>
                      <div className="flex flex-wrap gap-2">
                        {TYPE_OPTIONS.map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              const current = formData.type_filter || [];
                              const updated = current.includes(type)
                                ? current.filter((t) => t !== type)
                                : [...current, type];
                              setFormData({ ...formData, type_filter: updated.length ? updated : null });
                            }}
                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                              formData.type_filter?.includes(type)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-white/10 hover:bg-white/5'
                            }`}
                          >
                            {type.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingChannel(null);
                    }}
                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={createChannel.isPending || updateChannel.isPending}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {(createChannel.isPending || updateChannel.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingChannel ? (
                      <Check size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                    {editingChannel ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Channel"
        description="Are you sure you want to delete this notification channel? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => { if (deleteConfirm) await handleDelete(deleteConfirm); }}
        variant="danger"
      />
    </div>
  );
}
