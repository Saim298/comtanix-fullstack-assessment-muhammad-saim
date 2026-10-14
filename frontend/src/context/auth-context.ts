import { createContext } from "react";
import type { AuthUser } from "../lib/api";

export interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
    undefined
);
