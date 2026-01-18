import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  RefreshCw,
  Settings,
  FolderOpen,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Save,
  Trash2,
  HelpCircle,
  X,
  Key,
  Lock,
  Server,
  Container,
  Cloud,
  Terminal,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePulsarAuthStatus,
  usePulsarAuthValidation,
  useBrokerConfig,
  useUpdateBrokerConfig,
  useDeleteBrokerConfig,
  useTenants,
  useNamespaces,
} from '@/api/hooks';
import AuthStatusCard from '@/components/auth/AuthStatusCard';
import PermissionEditor from '@/components/auth/PermissionEditor';
import RbacSyncPanel from '@/components/auth/RbacSyncPanel';
import { ConfirmDialog } from '@/components/shared';
import { cn } from '@/lib/utils';

type TabType = 'status' | 'permissions' | 'sync' | 'config';
type GuideSection = 'overview' | 'docker' | 'kubernetes' | 'standalone' | 'cluster' | 'token' | 'oidc' | 'ai-prompt';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className={`p-4 bg-black/40 rounded-lg text-sm overflow-x-auto language-${language}`}>
        <code className="text-muted-foreground">{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copied ? (
          <Check size={14} className="text-green-500" />
        ) : (
          <Copy size={14} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function AuthGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<GuideSection>('overview');

  const sections: { id: GuideSection; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'docker', label: 'Docker', icon: Container },
    { id: 'kubernetes', label: 'K8S / OpenShift', icon: Cloud },
    { id: 'standalone', label: 'Standalone', icon: Terminal },
    { id: 'cluster', label: 'Cluster', icon: Server },
    { id: 'token', label: 'Token Secret Key', icon: Key },
    { id: 'oidc', label: 'OIDC Integration', icon: Lock },
    { id: 'ai-prompt', label: 'AI Prompt', icon: Sparkles },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="modal-solid border border-white/10 rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-popover-foreground">Pulsar Authentication Guide</h2>
                  <p className="text-sm text-muted-foreground">
                    How to enable and configure authentication
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-56 border-r border-white/10 p-4 flex-shrink-0 overflow-y-auto">
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-colors text-sm',
                        activeSection === section.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <section.icon size={16} />
                      {section.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeSection === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Understanding Pulsar Authentication</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Apache Pulsar supports pluggable authentication and authorization. Authentication
                        verifies <strong>who</strong> is connecting, while authorization determines <strong>what</strong> they can do.
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-500">Important</p>
                          <p className="text-sm text-yellow-400 mt-1">
                            Authentication can only be enabled via configuration files, not through the Admin API.
                            Changes require a broker restart to take effect.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Key Configuration Properties</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-white/5 rounded-lg">
                          <code className="text-primary text-sm">authenticationEnabled</code>
                          <p className="text-xs text-muted-foreground mt-1">Enable/disable authentication (true/false)</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <code className="text-primary text-sm">authorizationEnabled</code>
                          <p className="text-xs text-muted-foreground mt-1">Enable/disable authorization (true/false)</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <code className="text-primary text-sm">authenticationProviders</code>
                          <p className="text-xs text-muted-foreground mt-1">Comma-separated list of auth provider classes</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <code className="text-primary text-sm">superUserRoles</code>
                          <p className="text-xs text-muted-foreground mt-1">Comma-separated list of roles with admin access</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">What Can Be Managed via Admin API</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <p className="font-medium text-green-500 mb-2">Via Admin API</p>
                          <ul className="text-sm text-green-400 space-y-1">
                            <li>• Namespace permissions</li>
                            <li>• Topic permissions</li>
                            <li>• Tenant admin roles</li>
                            <li>• Grant/revoke access</li>
                          </ul>
                        </div>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="font-medium text-red-500 mb-2">Config File Only</p>
                          <ul className="text-sm text-red-400 space-y-1">
                            <li>• Enable/disable auth</li>
                            <li>• Auth provider selection</li>
                            <li>• Secret key configuration</li>
                            <li>• Superuser roles</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'docker' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Container className="text-primary" />
                        Docker Configuration
                      </h3>
                      <p className="text-muted-foreground">
                        Configure authentication using environment variables or mounted config files.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Option 1: Environment Variables</h4>
                      <CodeBlock
                        code={`docker run -d --name pulsar \\
  -p 6650:6650 -p 8080:8080 \\
  -e PULSAR_PREFIX_authenticationEnabled=true \\
  -e PULSAR_PREFIX_authorizationEnabled=true \\
  -e PULSAR_PREFIX_authenticationProviders=org.apache.pulsar.broker.authentication.AuthenticationProviderToken \\
  -e PULSAR_PREFIX_tokenSecretKey=file:///pulsar/conf/secret.key \\
  -e PULSAR_PREFIX_superUserRoles=admin \\
  -v /path/to/secret.key:/pulsar/conf/secret.key:ro \\
  apachepulsar/pulsar:latest bin/pulsar standalone`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Option 2: Docker Compose</h4>
                      <CodeBlock
                        language="yaml"
                        code={`version: '3.8'
services:
  pulsar:
    image: apachepulsar/pulsar:latest
    command: bin/pulsar standalone
    ports:
      - "6650:6650"
      - "8080:8080"
    environment:
      PULSAR_PREFIX_authenticationEnabled: "true"
      PULSAR_PREFIX_authorizationEnabled: "true"
      PULSAR_PREFIX_authenticationProviders: >-
        org.apache.pulsar.broker.authentication.AuthenticationProviderToken
      PULSAR_PREFIX_tokenSecretKey: "file:///pulsar/conf/secret.key"
      PULSAR_PREFIX_superUserRoles: "admin"
    volumes:
      - ./secret.key:/pulsar/conf/secret.key:ro
      - pulsar-data:/pulsar/data

volumes:
  pulsar-data:`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Option 3: Custom Config File</h4>
                      <CodeBlock
                        code={`# Create standalone.conf with auth settings
docker run -d --name pulsar \\
  -p 6650:6650 -p 8080:8080 \\
  -v /path/to/standalone.conf:/pulsar/conf/standalone.conf:ro \\
  -v /path/to/secret.key:/pulsar/conf/secret.key:ro \\
  apachepulsar/pulsar:latest bin/pulsar standalone`}
                      />
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="font-medium text-blue-500 mb-2">Generate Secret Key</p>
                      <CodeBlock
                        code={`# Generate a secret key for JWT tokens
docker run --rm apachepulsar/pulsar:latest \\
  bin/pulsar tokens create-secret-key --output /dev/stdout > secret.key`}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'kubernetes' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Cloud className="text-primary" />
                        Kubernetes / OpenShift / OKD
                      </h3>
                      <p className="text-muted-foreground">
                        Configure authentication using Secrets and ConfigMaps.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 1: Create Secret for Token Key</h4>
                      <CodeBlock
                        code={`# Generate secret key
bin/pulsar tokens create-secret-key --output secret.key

# Create Kubernetes secret
kubectl create secret generic pulsar-token-secret \\
  --from-file=secret.key=./secret.key \\
  -n pulsar`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 2: Create ConfigMap for Auth Settings</h4>
                      <CodeBlock
                        language="yaml"
                        code={`apiVersion: v1
kind: ConfigMap
metadata:
  name: pulsar-auth-config
  namespace: pulsar
data:
  PULSAR_PREFIX_authenticationEnabled: "true"
  PULSAR_PREFIX_authorizationEnabled: "true"
  PULSAR_PREFIX_authenticationProviders: >-
    org.apache.pulsar.broker.authentication.AuthenticationProviderToken
  PULSAR_PREFIX_tokenSecretKey: "file:///pulsar/secrets/secret.key"
  PULSAR_PREFIX_superUserRoles: "admin,pulsar-admin"
  PULSAR_PREFIX_brokerClientAuthenticationPlugin: >-
    org.apache.pulsar.client.impl.auth.AuthenticationToken
  PULSAR_PREFIX_brokerClientAuthenticationParameters: >-
    file:///pulsar/tokens/admin.jwt`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 3: Update Deployment/StatefulSet</h4>
                      <CodeBlock
                        language="yaml"
                        code={`apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: pulsar-broker
spec:
  template:
    spec:
      containers:
      - name: broker
        envFrom:
        - configMapRef:
            name: pulsar-auth-config
        volumeMounts:
        - name: token-secret
          mountPath: /pulsar/secrets
          readOnly: true
        - name: admin-token
          mountPath: /pulsar/tokens
          readOnly: true
      volumes:
      - name: token-secret
        secret:
          secretName: pulsar-token-secret
      - name: admin-token
        secret:
          secretName: pulsar-admin-token`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">OpenShift-Specific: Security Context</h4>
                      <CodeBlock
                        language="yaml"
                        code={`# For OpenShift, you may need to set appropriate SCCs
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: pulsar-scc
allowHostDirVolumePlugin: false
allowHostNetwork: false
allowHostPorts: false
allowPrivilegedContainer: false
runAsUser:
  type: MustRunAsRange
fsGroup:
  type: MustRunAs
volumes:
  - configMap
  - secret
  - persistentVolumeClaim`}
                      />
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="font-medium text-blue-500 mb-2">Helm Chart Configuration</p>
                      <CodeBlock
                        language="yaml"
                        code={`# values.yaml for Apache Pulsar Helm chart
auth:
  authentication:
    enabled: true
    provider: jwt
  authorization:
    enabled: true
  superUsers:
    broker: "admin"
    client: "admin"
    proxy: "admin"
tokens:
  secretKey: "pulsar-token-secret"
  adminToken: "pulsar-admin-token"`}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'standalone' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Terminal className="text-primary" />
                        Standalone Mode
                      </h3>
                      <p className="text-muted-foreground">
                        Configure authentication by editing <code>conf/standalone.conf</code>.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 1: Generate Secret Key</h4>
                      <CodeBlock
                        code={`cd /path/to/pulsar

# Generate a secret key
bin/pulsar tokens create-secret-key \\
  --output conf/my-secret.key`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 2: Generate Admin Token</h4>
                      <CodeBlock
                        code={`# Generate token for admin user
bin/pulsar tokens create \\
  --secret-key file:///path/to/pulsar/conf/my-secret.key \\
  --subject admin

# Save the output token to a file
bin/pulsar tokens create \\
  --secret-key file:///path/to/pulsar/conf/my-secret.key \\
  --subject admin > conf/admin.jwt`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 3: Edit standalone.conf</h4>
                      <CodeBlock
                        language="properties"
                        code={`# conf/standalone.conf

### --- Authentication Settings --- ###
authenticationEnabled=true
authenticationProviders=org.apache.pulsar.broker.authentication.AuthenticationProviderToken

# Token authentication settings
tokenSecretKey=file:///path/to/pulsar/conf/my-secret.key

### --- Authorization Settings --- ###
authorizationEnabled=true
authorizationProvider=org.apache.pulsar.broker.authorization.PulsarAuthorizationProvider

# Superuser roles (comma-separated)
superUserRoles=admin

### --- Broker Client Authentication --- ###
# Required for internal broker communication
brokerClientAuthenticationPlugin=org.apache.pulsar.client.impl.auth.AuthenticationToken
brokerClientAuthenticationParameters=file:///path/to/pulsar/conf/admin.jwt`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 4: Restart Pulsar</h4>
                      <CodeBlock
                        code={`# Stop Pulsar
bin/pulsar-daemon stop standalone

# Start Pulsar
bin/pulsar-daemon start standalone

# Or run in foreground
bin/pulsar standalone`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 5: Test with pulsar-admin</h4>
                      <CodeBlock
                        code={`# Set auth token
export PULSAR_AUTH_PARAMS="file:///path/to/pulsar/conf/admin.jwt"

# Or use command line argument
bin/pulsar-admin \\
  --auth-plugin org.apache.pulsar.client.impl.auth.AuthenticationToken \\
  --auth-params "file:///path/to/pulsar/conf/admin.jwt" \\
  tenants list`}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'cluster' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Server className="text-primary" />
                        Cluster Deployment
                      </h3>
                      <p className="text-muted-foreground">
                        In a cluster deployment, configure all brokers with the same authentication settings.
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-500">Critical Requirement</p>
                          <p className="text-sm text-yellow-400 mt-1">
                            All brokers in the cluster MUST use the same secret key. Otherwise, tokens
                            generated by one broker won't work on others.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 1: Generate Shared Secret Key</h4>
                      <CodeBlock
                        code={`# Generate secret key on one machine
bin/pulsar tokens create-secret-key --output /shared/path/secret.key

# Copy to all broker nodes (use secure method)
scp /shared/path/secret.key broker1:/pulsar/conf/
scp /shared/path/secret.key broker2:/pulsar/conf/
scp /shared/path/secret.key broker3:/pulsar/conf/`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 2: Configure broker.conf (All Brokers)</h4>
                      <CodeBlock
                        language="properties"
                        code={`# conf/broker.conf (same on all brokers)

### --- Authentication --- ###
authenticationEnabled=true
authenticationProviders=org.apache.pulsar.broker.authentication.AuthenticationProviderToken
tokenSecretKey=file:///pulsar/conf/secret.key

### --- Authorization --- ###
authorizationEnabled=true
authorizationProvider=org.apache.pulsar.broker.authorization.PulsarAuthorizationProvider
superUserRoles=admin,broker-admin

### --- Internal Communication --- ###
brokerClientAuthenticationPlugin=org.apache.pulsar.client.impl.auth.AuthenticationToken
brokerClientAuthenticationParameters=file:///pulsar/conf/broker.jwt

### --- TLS (Recommended for Production) --- ###
brokerServicePortTls=6651
webServicePortTls=8443
tlsEnabled=true
tlsCertificateFilePath=/pulsar/conf/broker.cert.pem
tlsKeyFilePath=/pulsar/conf/broker.key-pk8.pem
tlsTrustCertsFilePath=/pulsar/conf/ca.cert.pem`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 3: Configure Proxy (If Used)</h4>
                      <CodeBlock
                        language="properties"
                        code={`# conf/proxy.conf

authenticationEnabled=true
authenticationProviders=org.apache.pulsar.broker.authentication.AuthenticationProviderToken
tokenSecretKey=file:///pulsar/conf/secret.key

# Proxy's own authentication to brokers
brokerClientAuthenticationPlugin=org.apache.pulsar.client.impl.auth.AuthenticationToken
brokerClientAuthenticationParameters=file:///pulsar/conf/proxy.jwt`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 4: Rolling Restart</h4>
                      <CodeBlock
                        code={`# Restart brokers one by one to avoid downtime
# On each broker:
bin/pulsar-daemon stop broker
bin/pulsar-daemon start broker

# Wait for broker to rejoin cluster before proceeding to next`}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'token' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Key className="text-primary" />
                        Token Secret Key
                      </h3>
                      <p className="text-muted-foreground">
                        Understanding how <code>tokenSecretKey</code> works for JWT authentication.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">How It Works</h4>
                      <div className="p-4 bg-white/5 rounded-xl space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold">1</span>
                          </div>
                          <div>
                            <p className="font-medium text-popover-foreground">Secret Key Generation</p>
                            <p className="text-sm text-muted-foreground">
                              A cryptographic key is generated and stored securely on the broker.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold">2</span>
                          </div>
                          <div>
                            <p className="font-medium text-popover-foreground">Token Creation</p>
                            <p className="text-sm text-muted-foreground">
                              Tokens are signed using this key. The "subject" becomes the role/principal.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold">3</span>
                          </div>
                          <div>
                            <p className="font-medium text-popover-foreground">Token Validation</p>
                            <p className="text-sm text-muted-foreground">
                              Broker validates incoming tokens using the same key. Invalid signatures are rejected.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Symmetric vs Asymmetric Keys</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-blue-400 mb-2">Symmetric (Secret Key)</p>
                          <p className="text-sm text-muted-foreground mb-3">Same key for signing and verification</p>
                          <CodeBlock
                            code={`# Generate symmetric key
bin/pulsar tokens create-secret-key \\
  --output secret.key

# In broker.conf
tokenSecretKey=file:///path/secret.key`}
                          />
                        </div>
                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-green-400 mb-2">Asymmetric (Key Pair)</p>
                          <p className="text-sm text-muted-foreground mb-3">Private key signs, public key verifies</p>
                          <CodeBlock
                            code={`# Generate key pair
bin/pulsar tokens create-key-pair \\
  --output-private-key private.key \\
  --output-public-key public.key

# In broker.conf
tokenPublicKey=file:///path/public.key`}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Creating Tokens for Different Roles</h4>
                      <CodeBlock
                        code={`# Admin token (superuser)
bin/pulsar tokens create \\
  --secret-key file:///path/to/secret.key \\
  --subject admin

# Service account token
bin/pulsar tokens create \\
  --secret-key file:///path/to/secret.key \\
  --subject order-service

# Token with expiration (recommended)
bin/pulsar tokens create \\
  --secret-key file:///path/to/secret.key \\
  --subject analytics-reader \\
  --expiry-time 30d`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Token Structure (JWT)</h4>
                      <div className="p-4 bg-white/5 rounded-lg font-mono text-sm">
                        <p className="text-red-400">eyJhbGciOiJIUzI1NiJ9</p>
                        <p className="text-muted-foreground text-xs mb-2">Header (algorithm)</p>
                        <p className="text-green-400">.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTczNTY4OTYwMH0</p>
                        <p className="text-muted-foreground text-xs mb-2">Payload (subject, expiry)</p>
                        <p className="text-blue-400">.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c</p>
                        <p className="text-muted-foreground text-xs">Signature (verified with secret key)</p>
                      </div>
                    </div>

                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-500">Security Best Practices</p>
                          <ul className="text-sm text-red-400 mt-2 space-y-1">
                            <li>• Never commit secret keys to version control</li>
                            <li>• Use asymmetric keys in production (separate signing authority)</li>
                            <li>• Set token expiration for non-admin tokens</li>
                            <li>• Rotate keys periodically</li>
                            <li>• Use Kubernetes Secrets or vault for key storage</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'oidc' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Lock className="text-primary" />
                        OIDC Integration
                      </h3>
                      <p className="text-muted-foreground">
                        Integrate Pulsar with OpenID Connect providers (Keycloak, Auth0, Okta, Zitadel).
                      </p>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="font-medium text-blue-500 mb-2">Note on Pulsar OAuth2</p>
                      <p className="text-sm text-blue-400">
                        Pulsar uses OAuth2 Client Credentials flow for machine-to-machine authentication,
                        not PKCE (which is for interactive user flows). Tokens from your OIDC provider
                        are validated by Pulsar using the provider's public keys.
                      </p>
                    </div>

                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <p className="font-medium text-green-500 mb-2">Recommended: JWKS for OIDC</p>
                      <p className="text-sm text-green-400">
                        When using OIDC, use the JWKS (JSON Web Key Set) endpoint instead of a static public key.
                        JWKS provides automatic key rotation and eliminates manual key management.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" />
                        How JWKS Works
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        OIDC providers publish their public keys at a JWKS endpoint. Pulsar fetches these keys
                        to validate JWT tokens. This enables automatic key rotation without broker restarts.
                      </p>

                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-yellow-400 mb-2">1. Discovery URL → JWKS Endpoint</p>
                          <p className="text-sm text-muted-foreground mb-3">
                            Every OIDC provider has a discovery URL that contains the JWKS endpoint location:
                          </p>
                          <CodeBlock
                            code={`# The OpenID Configuration URL
https://your-provider.com/.well-known/openid-configuration

# Returns JSON with jwks_uri field:
{
  "issuer": "https://your-provider.com",
  "jwks_uri": "https://your-provider.com/.well-known/jwks.json",
  "token_endpoint": "https://your-provider.com/oauth/token",
  ...
}`}
                          />
                        </div>

                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-yellow-400 mb-2">2. JWKS Endpoint Response</p>
                          <p className="text-sm text-muted-foreground mb-3">
                            The JWKS endpoint returns a set of public keys used to sign tokens:
                          </p>
                          <CodeBlock
                            code={`# GET https://your-provider.com/.well-known/jwks.json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key-id-123",           # Key ID - matches 'kid' in JWT header
      "alg": "RS256",                # Algorithm
      "n": "0vx7agoebGc...",         # RSA modulus (public key component)
      "e": "AQAB"                    # RSA exponent
    },
    {
      "kty": "EC",
      "use": "sig",
      "kid": "key-id-456",
      "alg": "ES256",
      "crv": "P-256",
      "x": "f83OJ3D2xF1Bg8vub...",
      "y": "x_FEzRu9m36HLN_tue..."
    }
  ]
}`}
                          />
                        </div>

                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-yellow-400 mb-2">3. Token Validation Flow</p>
                          <div className="text-sm space-y-2 text-muted-foreground">
                            <p>① Client sends JWT token to Pulsar broker</p>
                            <p>② Broker reads <code className="text-primary">kid</code> (key ID) from JWT header</p>
                            <p>③ Broker fetches JWKS from configured URL (with caching)</p>
                            <p>④ Broker finds matching key by <code className="text-primary">kid</code></p>
                            <p>⑤ Broker validates JWT signature using that public key</p>
                            <p>⑥ If valid, broker extracts claims for authorization</p>
                          </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-yellow-400 mb-2">4. Benefits of JWKS</p>
                          <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                            <li><strong>Automatic Key Rotation:</strong> Provider can rotate keys without Pulsar restart</li>
                            <li><strong>Multiple Keys:</strong> Support for key rollover with old and new keys active simultaneously</li>
                            <li><strong>No Manual Key Distribution:</strong> No need to copy public keys to broker config</li>
                            <li><strong>Standard Protocol:</strong> Works with any OIDC-compliant provider</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 text-popover-foreground">Find Your JWKS URL</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use curl to discover the JWKS endpoint from your OIDC provider:
                      </p>
                      <CodeBlock
                        code={`# Fetch the OpenID Configuration
curl -s https://your-provider.com/.well-known/openid-configuration | jq .jwks_uri

# Example output:
"https://your-provider.com/.well-known/jwks.json"

# Verify the JWKS endpoint works
curl -s https://your-provider.com/.well-known/jwks.json | jq .`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 text-popover-foreground">Step 1: Configure OIDC Provider</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Create a client application in your OIDC provider:
                      </p>
                      <div className="p-4 bg-white/5 rounded-lg">
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b border-white/10">
                              <td className="py-2 text-muted-foreground">Grant Type</td>
                              <td className="py-2 text-popover-foreground">Client Credentials</td>
                            </tr>
                            <tr className="border-b border-white/10">
                              <td className="py-2 text-muted-foreground">Client ID</td>
                              <td className="py-2 text-popover-foreground">pulsar-broker</td>
                            </tr>
                            <tr className="border-b border-white/10">
                              <td className="py-2 text-muted-foreground">Client Secret</td>
                              <td className="py-2 text-popover-foreground">(generated by provider)</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-muted-foreground">Audience</td>
                              <td className="py-2 text-popover-foreground">pulsar (or your custom value)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 2: Configure Pulsar Broker with JWKS</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Point <code className="text-primary">tokenPublicKey</code> to your OIDC provider's JWKS endpoint:
                      </p>
                      <CodeBlock
                        language="properties"
                        code={`# broker.conf - OIDC Authentication with JWKS

authenticationEnabled=true
authenticationProviders=org.apache.pulsar.broker.authentication.AuthenticationProviderToken

# ============================================
# JWKS Configuration (Recommended for OIDC)
# ============================================
# Point to your OIDC provider's JWKS endpoint
# Pulsar will fetch public keys automatically and cache them
# Keys are refreshed periodically to support rotation

tokenPublicKey=https://your-provider.com/.well-known/jwks.json

# Alternative: Use file:// for a local JWKS file (not recommended)
# tokenPublicKey=file:///path/to/jwks.json

# ============================================
# JWT Claims Configuration
# ============================================
# Which claim to use as the "principal" (user/role identity)
tokenAuthClaim=sub

# Audience validation (must match 'aud' claim in token)
tokenAudienceClaim=aud
tokenAudience=pulsar

# ============================================
# Authorization
# ============================================
authorizationEnabled=true
superUserRoles=pulsar-admin,admin@your-provider.com

# Allow functions/connectors operations
authorizationAllowFunctionOps=true`}
                      />
                      <p className="text-sm text-muted-foreground mt-3">
                        Pulsar caches JWKS responses and automatically refreshes them. When your OIDC provider
                        rotates keys, Pulsar will pick up the new keys without requiring a restart.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Step 3: Client Configuration</h4>
                      <CodeBlock
                        code={`# pulsar-admin with OAuth2
bin/pulsar-admin \\
  --auth-plugin org.apache.pulsar.client.impl.auth.oauth2.AuthenticationOAuth2 \\
  --auth-params '{
    "type": "client_credentials",
    "issuerUrl": "https://your-provider.com",
    "clientId": "pulsar-client",
    "clientSecret": "your-client-secret",
    "audience": "pulsar"
  }' \\
  tenants list`}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 text-popover-foreground">Provider-Specific Examples</h4>
                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-orange-400 mb-2">Keycloak</p>
                          <CodeBlock
                            language="properties"
                            code={`# JWKS URL format for Keycloak
tokenPublicKey=https://keycloak.example.com/realms/pulsar/protocol/openid-connect/certs

# Claims mapping
tokenAuthClaim=preferred_username
tokenAudienceClaim=aud
tokenAudience=pulsar-broker`}
                          />
                        </div>

                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-purple-400 mb-2">Auth0</p>
                          <CodeBlock
                            language="properties"
                            code={`# JWKS URL format for Auth0
tokenPublicKey=https://your-tenant.auth0.com/.well-known/jwks.json

# Claims mapping
tokenAuthClaim=sub
tokenAudienceClaim=aud
tokenAudience=https://pulsar.example.com`}
                          />
                        </div>

                        <div className="p-4 bg-white/5 rounded-lg">
                          <p className="font-medium text-cyan-400 mb-2">Zitadel</p>
                          <CodeBlock
                            language="properties"
                            code={`# JWKS URL format for Zitadel
tokenPublicKey=https://your-instance.zitadel.cloud/oauth/v2/keys

# Claims mapping
tokenAuthClaim=sub
tokenAudienceClaim=aud
tokenAudience=your-project-id`}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Mapping OIDC Roles to Pulsar Permissions</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        After authentication, use the subject claim as the role for authorization:
                      </p>
                      <CodeBlock
                        code={`# Grant permissions to OIDC subject/client
bin/pulsar-admin namespaces grant-permission my-tenant/my-namespace \\
  --role "service-account-uuid-from-oidc" \\
  --actions produce,consume

# Or use group claims if configured
bin/pulsar-admin namespaces grant-permission my-tenant/my-namespace \\
  --role "oidc-group:analytics-team" \\
  --actions consume`}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'ai-prompt' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="text-primary" />
                        AI Configuration Prompt
                      </h3>
                      <p className="text-muted-foreground">
                        Copy this prompt and paste it into an AI assistant (like Claude, ChatGPT, or Copilot)
                        to get help configuring Pulsar authentication for your specific environment.
                      </p>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="font-medium text-blue-500 mb-2">How to Use</p>
                      <ol className="text-sm text-blue-400 space-y-1 list-decimal list-inside">
                        <li>Copy the prompt below using the copy button</li>
                        <li>Paste it into your preferred AI assistant</li>
                        <li>Answer the AI's questions about your environment</li>
                        <li>Follow the generated configuration instructions</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Complete Configuration Prompt</h4>
                      <CodeBlock
                        language="markdown"
                        code={`# Apache Pulsar Authentication & Authorization Configuration

Help me configure authentication and authorization for Apache Pulsar.

## My Environment
Please ask me about:
1. **Deployment type**: Docker, Kubernetes/OpenShift/OKD, Standalone, or Cluster
2. **Authentication method**: JWT with secret key, JWT with public/private key pair, or OIDC
3. **OIDC provider** (if applicable): Keycloak, Auth0, Zitadel, Okta, or other
4. **OIDC Discovery URL** (if applicable): e.g., https://auth.example.com/.well-known/openid-configuration

## Configuration Requirements

### 1. Broker Configuration (broker.conf)
Generate the complete broker.conf settings for:
- \`authenticationEnabled\`: Enable authentication
- \`authorizationEnabled\`: Enable authorization
- \`authenticationProviders\`: The authentication provider class
- \`tokenSecretKey\` or \`tokenPublicKey\`: Key configuration
- \`superUserRoles\`: Admin roles
- \`tokenAuthClaim\`: JWT claim for user identity
- \`tokenAudienceClaim\` and \`tokenAudience\`: Audience validation

### 2. Key Management
Based on my authentication method:
- **Symmetric key**: Generate a secure secret key and show how to store it
- **Asymmetric keys**: Show how to generate RSA/EC key pairs
- **OIDC/JWKS**: Configure the JWKS endpoint URL from my provider

### 3. Deployment-Specific Instructions
For my deployment type, provide:
- **Docker**: Environment variables (PULSAR_PREFIX_*) and volume mounts
- **Docker Compose**: Complete docker-compose.yml snippet
- **Kubernetes**: Secret, ConfigMap, and StatefulSet/Deployment manifests
- **Helm**: values.yaml configuration for the official Pulsar Helm chart
- **Standalone**: Step-by-step broker.conf changes and restart commands
- **Cluster**: Rolling restart procedure and shared key distribution

### 4. Token Generation
Show me how to generate tokens for:
- Admin/superuser access
- Regular client access
- With specific claims for authorization

### 5. Client Configuration
Provide examples for:
- pulsar-admin CLI authentication parameters
- Java/Python client connection with authentication
- OAuth2 client credentials flow (if using OIDC)

### 6. Permission Management
Show how to:
- Grant namespace permissions to roles
- Grant topic-level permissions
- List current permissions
- Revoke permissions

### 7. Verification Steps
Provide commands to verify:
- Authentication is working
- Authorization is enforced
- Token validation is correct

## OIDC-Specific (if applicable)

If I'm using OIDC, also include:
1. How to discover the JWKS endpoint from the discovery URL
2. JWT claims mapping (sub, aud, preferred_username, etc.)
3. Token audience configuration
4. Key rotation handling
5. Example of obtaining a token via client credentials grant

## Identity Provider Application Setup

For my chosen OIDC provider, explain how to create and configure the application:

### Keycloak
- Create a new Client in the realm
- Client type: **OpenID Connect**
- Client authentication: **ON** (confidential client)
- Authentication flow: Enable **Service accounts roles** (for Client Credentials)
- Set valid redirect URIs (if needed for admin console)
- Copy: Client ID, Client Secret
- Note the realm's JWKS URL: \`https://{host}/realms/{realm}/protocol/openid-connect/certs\`

### Auth0
- Create a new Application
- Application type: **Machine to Machine**
- Authorize the application for your API
- Copy: Domain, Client ID, Client Secret
- Create an API with a custom identifier (audience)
- JWKS URL: \`https://{tenant}.auth0.com/.well-known/jwks.json\`

### Zitadel
- Create a new Application
- Application type: **API** (for machine-to-machine)
- Authentication method: **Client Secret Basic** or **Private Key JWT**
- Copy: Client ID, Client Secret (or generate key)
- Create a Project and note the Resource ID (used as audience)
- JWKS URL: \`https://{instance}.zitadel.cloud/oauth/v2/keys\`

### Okta
- Create a new Application
- Application type: **API Services** (machine-to-machine)
- Grant type: **Client Credentials**
- Copy: Client ID, Client Secret
- Create an Authorization Server or use default
- Note the audience (issuer URI or custom)
- JWKS URL: \`https://{org}.okta.com/oauth2/{authServerId}/v1/keys\`

For each provider, also show:
- How to add custom claims to tokens (for roles/permissions)
- How to configure token lifetime
- How to test token generation with curl

## Output Format

Please provide:
1. A clear step-by-step guide
2. All configuration files with comments explaining each setting
3. Commands to test each step
4. Troubleshooting tips for common issues

Start by asking me about my deployment type and authentication method.`}
                      />
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="font-medium text-yellow-500 mb-2">Tips for Better Results</p>
                      <ul className="text-sm text-yellow-400 space-y-1 list-disc list-inside">
                        <li>Be specific about your Pulsar version (e.g., 3.0, 2.11)</li>
                        <li>Mention if you're using the official Helm chart or a custom deployment</li>
                        <li>For OIDC, have your discovery URL ready</li>
                        <li>Specify if you need mTLS in addition to token authentication</li>
                        <li>Mention any existing configuration you want to preserve</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PulsarAuthPage() {
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [newConfigValue, setNewConfigValue] = useState('');
  const [deleteConfigConfirm, setDeleteConfigConfirm] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Auth status queries
  const {
    data: authStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = usePulsarAuthStatus();

  const {
    data: validation,
    isLoading: validationLoading,
    refetch: refetchValidation,
  } = usePulsarAuthValidation();

  // Broker config
  const { data: brokerConfig, isLoading: configLoading } = useBrokerConfig();
  const updateConfig = useUpdateBrokerConfig();
  const deleteConfig = useDeleteBrokerConfig();

  // Tenant/namespace selection for permissions
  const { data: tenants } = useTenants({ useCache: true });
  const { data: namespaces } = useNamespaces(selectedTenant, true);

  const handleUpdateConfig = async (configName: string) => {
    if (!newConfigValue.trim()) {
      toast.error('Value is required');
      return;
    }

    try {
      await updateConfig.mutateAsync({
        configName,
        value: newConfigValue,
      });
      toast.success(`Updated ${configName}`);
      setEditingConfig(null);
      setNewConfigValue('');
    } catch {
      toast.error(`Failed to update ${configName}`);
    }
  };

  const handleDeleteConfig = async () => {
    if (!deleteConfigConfirm) return;

    try {
      await deleteConfig.mutateAsync(deleteConfigConfirm);
      toast.success(`Deleted ${deleteConfigConfirm}`);
      setDeleteConfigConfirm(null);
    } catch {
      toast.error(`Failed to delete ${deleteConfigConfirm}`);
    }
  };

  const tabs: { id: TabType; label: string; icon: typeof Shield }[] = [
    { id: 'status', label: 'Status', icon: Shield },
    { id: 'permissions', label: 'Permissions', icon: FolderOpen },
    { id: 'sync', label: 'RBAC Sync', icon: RefreshCw },
    { id: 'config', label: 'Broker Config', icon: Settings },
  ];

  // Filter auth-related config keys
  const authConfigKeys = brokerConfig
    ? Object.entries(brokerConfig).filter(
        ([key]) =>
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('super') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('tls')
      )
    : [];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="text-primary" />
            Pulsar Authentication
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage authentication, authorization, and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex items-center gap-2"
          >
            <HelpCircle size={18} />
            How-to Guide
          </button>
          <button
            onClick={() => {
              refetchStatus();
              refetchValidation();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={20}
              className={cn(
                (statusLoading || validationLoading) && 'animate-spin'
              )}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-6 py-4 transition-all duration-200 flex items-center gap-2 relative group',
                isActive
                  ? 'text-blue-400 bg-blue-500/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <tab.icon 
                size={18} 
                className={cn(
                  "transition-colors",
                  isActive ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground"
                )} 
              />
              <span className={cn(
                "font-semibold transition-colors",
                isActive ? "text-blue-400" : ""
              )}>
                {tab.label}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Status Tab */}
        {activeTab === 'status' && (
          <AuthStatusCard
            status={authStatus}
            validation={validation}
            isLoading={statusLoading}
            isValidating={validationLoading}
          />
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="space-y-6">
            {/* Namespace Selector */}
            <div className="glass rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold mb-4">Select Namespace</h3>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">
                    Tenant
                  </label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => {
                      setSelectedTenant(e.target.value);
                      setSelectedNamespace('');
                    }}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select tenant...</option>
                    {tenants?.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <ChevronRight className="w-6 h-6 text-muted-foreground mb-3" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">
                    Namespace
                  </label>
                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    disabled={!selectedTenant}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select namespace...</option>
                    {namespaces?.map((ns) => (
                      <option key={ns.namespace} value={ns.namespace}>
                        {ns.namespace}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Permission Editor */}
            {selectedTenant && selectedNamespace ? (
              <PermissionEditor
                tenant={selectedTenant}
                namespace={selectedNamespace}
              />
            ) : (
              <div className="glass rounded-xl p-8 text-center border border-white/10">
                <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Select a tenant and namespace to manage permissions
                </p>
              </div>
            )}
          </div>
        )}

        {/* RBAC Sync Tab */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            {/* Namespace Selector */}
            <div className="glass rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold mb-4">Select Namespace</h3>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">
                    Tenant
                  </label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => {
                      setSelectedTenant(e.target.value);
                      setSelectedNamespace('');
                    }}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select tenant...</option>
                    {tenants?.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <ChevronRight className="w-6 h-6 text-muted-foreground mb-3" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">
                    Namespace
                  </label>
                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    disabled={!selectedTenant}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select namespace...</option>
                    {namespaces?.map((ns) => (
                      <option key={ns.namespace} value={ns.namespace}>
                        {ns.namespace}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* RBAC Sync Panel */}
            {selectedTenant && selectedNamespace ? (
              <RbacSyncPanel
                tenant={selectedTenant}
                namespace={selectedNamespace}
              />
            ) : (
              <div className="glass rounded-xl p-8 text-center border border-white/10">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Select a tenant and namespace to sync RBAC
                </p>
              </div>
            )}
          </div>
        )}

        {/* Broker Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Warning */}
            <div className="p-4 bg-yellow-500/10 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">
                  Caution: Broker Configuration
                </p>
                <p className="text-sm text-yellow-400 mt-1">
                  Modifying broker configuration can affect cluster behavior.
                  Some changes require a broker restart to take effect.
                </p>
              </div>
            </div>

            {/* Config List */}
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-semibold">Auth-Related Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Dynamic broker configuration values
                </p>
              </div>

              {configLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : authConfigKeys.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {authConfigKeys.map(([key, value]) => (
                    <div
                      key={key}
                      className="p-4 flex items-center gap-4 hover:bg-white/5"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-sm text-primary">{key}</code>
                        {editingConfig === key ? (
                          <input
                            type="text"
                            value={newConfigValue}
                            onChange={(e) => setNewConfigValue(e.target.value)}
                            className="w-full mt-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="New value..."
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {value || '(empty)'}
                          </p>
                        )}
                      </div>
                      {editingConfig === key ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingConfig(null);
                              setNewConfigValue('');
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <ChevronRight
                              size={18}
                              className="rotate-90 text-muted-foreground"
                            />
                          </button>
                          <button
                            onClick={() => handleUpdateConfig(key)}
                            disabled={updateConfig.isPending}
                            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {updateConfig.isPending ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Save size={18} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingConfig(key);
                              setNewConfigValue(value);
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Settings size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteConfigConfirm(key)}
                            className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Settings className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No auth-related configuration found
                  </p>
                </div>
              )}
            </div>

            {/* All Config (expandable) */}
            {brokerConfig && Object.keys(brokerConfig).length > 0 && (
              <details className="glass rounded-xl border border-white/10 overflow-hidden">
                <summary className="p-4 cursor-pointer hover:bg-white/5 font-medium">
                  All Dynamic Configuration ({Object.keys(brokerConfig).length}{' '}
                  keys)
                </summary>
                <div className="p-4 border-t border-white/10 max-h-96 overflow-auto">
                  <pre className="text-xs text-muted-foreground">
                    {JSON.stringify(brokerConfig, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </motion.div>

      {/* Delete Config Confirmation */}
      <ConfirmDialog
        open={!!deleteConfigConfirm}
        onOpenChange={(open) => !open && setDeleteConfigConfirm(null)}
        title="Delete Configuration"
        description={`Are you sure you want to delete "${deleteConfigConfirm}"? This will reset the setting to its default value.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfig}
        variant="danger"
        loading={deleteConfig.isPending}
      />

      {/* Auth Guide Modal */}
      <AuthGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
