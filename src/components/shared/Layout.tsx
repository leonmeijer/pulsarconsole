import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { AuthEventListener, PendingAccess } from "@/components/auth";
import { useAuth } from "@/context/AuthContext";

export default function Layout() {
    const { isAuthenticated, authRequired, hasAccess, refreshAuth } = useAuth();

    // If auth is required, user is authenticated, but doesn't have access
    // Show the pending access screen
    const showPendingAccess = authRequired && isAuthenticated && !hasAccess;

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <AuthEventListener />
            {showPendingAccess ? (
                // Show pending access screen without sidebar for users without roles
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-8 relative">
                        <PendingAccess onRetry={refreshAuth} />
                    </main>
                </div>
            ) : (
                // Normal layout with sidebar
                <>
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex-1 overflow-y-auto p-8 relative">
                            <Outlet />
                        </main>
                    </div>
                </>
            )}
        </div>
    );
}
