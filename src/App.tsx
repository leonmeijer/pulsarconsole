import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Layout from "./components/shared/Layout";
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
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
        path: "environment",
        element: <EnvironmentPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
