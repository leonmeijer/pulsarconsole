import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Layout from "./components/shared/Layout";
import { ProtectedRoute } from "./components/auth";
import DashboardPage from "./pages/Dashboard";
import TenantsPage from "./pages/Tenants";
import NamespacesPage from "./pages/Namespaces";
import TopicsPage from "./pages/Topics";
import TopicDetailPage from "./pages/TopicDetail";
import SubscriptionsPage from "./pages/Subscriptions";
import SubscriptionDetailPage from "./pages/SubscriptionDetail";
import BrokersPage from "./pages/Brokers";
import EnvironmentPage from "./pages/Environment";
import AuditLogsPage from "./pages/AuditLogs";
import NotificationsPage from "./pages/Notifications";
import LoginPage from "./pages/LoginPage";
import { TokensPage, RolesPage, UsersPage, SessionsPage, PulsarAuthPage, OIDCSettingsPage } from "./pages/settings";
import { useRealtimeSync } from "./hooks/useRealtimeSync";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "tenants",
        element: <TenantsPage />,
      },
      {
        path: "tenants/:tenant/namespaces",
        element: <NamespacesPage />,
      },
      {
        path: "tenants/:tenant/namespaces/:namespace/topics",
        element: <TopicsPage />,
      },
      {
        path: "tenants/:tenant/namespaces/:namespace/topics/:topic",
        element: <TopicDetailPage />,
      },
      {
        path: "tenants/:tenant/namespaces/:namespace/topics/:topic/subscriptions",
        element: <SubscriptionsPage />,
      },
      {
        path: "tenants/:tenant/namespaces/:namespace/topics/:topic/subscription/:subscription",
        element: <SubscriptionDetailPage />,
      },
      {
        path: "brokers",
        element: <BrokersPage />,
      },
      {
        path: "audit-logs",
        element: <AuditLogsPage />,
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "environment",
        element: <EnvironmentPage />,
      },
      // Settings routes
      {
        path: "settings/tokens",
        element: <TokensPage />,
      },
      {
        path: "settings/roles",
        element: <RolesPage />,
      },
      {
        path: "settings/users",
        element: <UsersPage />,
      },
      {
        path: "settings/sessions",
        element: <SessionsPage />,
      },
      {
        path: "settings/pulsar-auth",
        element: <PulsarAuthPage />,
      },
      {
        path: "settings/oidc",
        element: <OIDCSettingsPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  }
]);

export default function App() {
  useRealtimeSync();
  return <RouterProvider router={router} />;
}
