import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api";
import { quotesApi } from "./quotesApi";
import type { AssignedUser } from "./types";

export default function AssigneeFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const { user } = useAuth();
    const [staff, setStaff] = useState<AssignedUser[]>([]);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const isAdmin = user?.role === "admin";

    useEffect(() => {
        if (!isAdmin) return;
        const controller = new AbortController();
        const loadStaff = async () => {
            setError("");
            try {
                const users = await quotesApi.getStaff(controller.signal);
                if (!controller.signal.aborted) setStaff(users);
            } catch (err) {
                if (!controller.signal.aborted) setError(getApiErrorMessage(err));
            }
        };
        void loadStaff();
        return () => controller.abort();
    }, [isAdmin, attempt]);

    const options = isAdmin ? staff : user ? [{ id: user.id, name: "Assigned to me" }] : [];
    const unknownAssignee = value && value !== "unassigned" && !options.some((option) => String(option.id) === value);

    return (
        <div>
            <label htmlFor="quote-assignee" className="mb-2 block text-xs font-medium text-slate-600">Assigned to</label>
            <select id="quote-assignee" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-700">
                <option value="">All assignees</option>
                <option value="unassigned">Unassigned</option>
                {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                {unknownAssignee && <option value={value}>Staff #{value}</option>}
            </select>
            {isAdmin && error && <p role="alert" className="mt-2 text-xs text-red-700">{error} <button type="button" onClick={() => setAttempt((previous) => previous + 1)} className="cursor-pointer underline">Retry staff list</button></p>}
        </div>
    );
}
