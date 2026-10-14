import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [signingOut, setSigningOut] = useState(false);

    const handleLogout = async () => {
        setSigningOut(true);
        const revoked = await logout();
        navigate("/login", {
            replace: true,
            state: revoked ? null : {
                notice: "Your local session ended, but server token revocation could not be confirmed.",
            },
        });
    };

    return (
        <main className="min-h-screen bg-slate-100">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Comtanix</h1>
                        <p className="text-xs text-slate-500">Quote Request Management</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                            <p className="text-xs capitalize text-slate-500">{user?.role}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={signingOut}
                            className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            {signingOut ? "Signing out..." : "Sign Out"}
                        </button>
                    </div>
                </div>
            </header>
            <section className="mx-auto max-w-7xl px-5 py-8">{children}</section>
        </main>
    );
}
