import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
export function useCurrentUser() {
    const user = useQuery(api.users.getMe);
    return {
        user,
        isLoading: user === undefined,
        isAdmin: user?.role === "ADMIN",
        isCleaner: user?.role === "CLEANER",
        isInspector: user?.role === "INSPECTOR",
    };
}
