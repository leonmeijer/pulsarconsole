import { motion } from "framer-motion";
import { Server, Activity, Database, ShieldCheck } from "lucide-react";

export default function ClustersPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Clusters</h1>
                    <p className="text-muted-foreground mt-1">Monitor and manage your Pulsar clusters across all environments.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Active Clusters", value: "3", icon: Server, color: "text-blue-500" },
                    { label: "Total Brokers", value: "12", icon: Activity, color: "text-green-500" },
                    { label: "Total Bookies", value: "24", icon: Database, color: "text-purple-500" },
                    { label: "Health Score", value: "98%", icon: ShieldCheck, color: "text-yellow-500" },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="glass p-6 rounded-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className={`p-3 bg-white/5 rounded-xl ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                            <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-primary">Active Clusters</h2>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-muted-foreground text-sm">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Service URL</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Brokers</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {[
                                { name: "standalone", url: "pulsar://localhost:6650", brokers: 1, status: "Healthy" },
                                { name: "production-us", url: "pulsar://pulsar.prod-us:6650", brokers: 5, status: "Healthy" },
                                { name: "production-eu", url: "pulsar://pulsar.prod-eu:6650", brokers: 6, status: "Healthy" },
                            ].map((cluster) => (
                                <tr key={cluster.name} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5 font-medium">{cluster.name}</td>
                                    <td className="px-6 py-5 text-muted-foreground font-mono text-xs">{cluster.url}</td>
                                    <td className="px-6 py-5">{cluster.brokers}</td>
                                    <td className="px-6 py-5">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold ring-1 ring-green-500/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            {cluster.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <button className="text-primary text-sm font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                                            Configure
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
