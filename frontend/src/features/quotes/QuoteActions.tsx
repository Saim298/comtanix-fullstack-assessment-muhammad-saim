import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api";
import { permittedStatuses, statusLabels } from "./quotePresentation";
import { quotesApi } from "./quotesApi";
import type { AssignedUser, QuoteRequest, QuoteStatus } from "./types";

interface QuoteActionsProps {
    quote: QuoteRequest;
    onUpdate: (quote: QuoteRequest) => void;
}

export default function QuoteActions({ quote, onUpdate }: QuoteActionsProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === "admin";
    const allowedStatuses = permittedStatuses(quote, user);
    const [staff, setStaff] = useState<AssignedUser[]>([]);
    const [staffLoading, setStaffLoading] = useState(isAdmin);
    const [staffError, setStaffError] = useState("");
    const [staffRefresh, setStaffRefresh] = useState(0);
    const [selectedStaff, setSelectedStaff] = useState(String(quote.assigned_user_id ?? ""));
    const [pending, setPending] = useState<"assignment" | "status" | "delete" | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const mutation = useRef<AbortController | null>(null);
    const deleteDialog = useRef<HTMLDialogElement>(null);

    useEffect(() => () => mutation.current?.abort(), []);

    useEffect(() => {
        if (!isAdmin) return;
        const controller = new AbortController();
        const load = async () => {
            setStaffLoading(true);
            setStaffError("");
            try {
                const response = await quotesApi.getStaff(controller.signal);
                if (!controller.signal.aborted) setStaff(response);
            } catch (err) {
                if (!controller.signal.aborted) setStaffError(getApiErrorMessage(err));
            } finally {
                if (!controller.signal.aborted) setStaffLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [isAdmin, staffRefresh]);

    const update = async (action: "assignment" | "status", status?: QuoteStatus) => {
        if (mutation.current && !mutation.current.signal.aborted) return;
        const controller = new AbortController();
        mutation.current = controller;
        setPending(action);
        setError("");
        setSuccess("");
        try {
            const response = action === "assignment"
                ? await quotesApi.assign(quote.id, Number(selectedStaff), controller.signal)
                : await quotesApi.updateStatus(quote.id, status!, controller.signal);
            if (!controller.signal.aborted) {
                onUpdate(response);
                setSelectedStaff(String(response.assigned_user_id ?? ""));
                setSuccess(action === "assignment" ? "Staff assignment updated." : `Status updated to ${statusLabels[response.status]}.`);
            }
        } catch (err) {
            if (!controller.signal.aborted) setError(getApiErrorMessage(err));
        } finally {
            if (!controller.signal.aborted) {
                mutation.current = null;
                setPending(null);
            }
        }
    };

    const remove = async () => {
        if (mutation.current && !mutation.current.signal.aborted) return;
        const controller = new AbortController();
        mutation.current = controller;
        setPending("delete");
        setDeleteError("");
        try {
            await quotesApi.remove(quote.id, controller.signal);
            if (!controller.signal.aborted) {
                deleteDialog.current?.close();
                navigate("/dashboard", { replace: true, state: { notice: `Quote #${quote.id} deleted.` } });
            }
        } catch (err) {
            if (!controller.signal.aborted) setDeleteError(getApiErrorMessage(err));
        } finally {
            if (!controller.signal.aborted) {
                mutation.current = null;
                setPending(null);
            }
        }
    };

    const canAssign = isAdmin && !staffLoading && !staffError && staff.some((member) => member.id === Number(selectedStaff))
        && Number(selectedStaff) !== quote.assigned_user_id;

    return (
        <section aria-labelledby="manage-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 id="manage-title" className="font-semibold text-slate-900">Manage quote</h3>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {success && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
            {isAdmin && (
                <form onSubmit={(event) => { event.preventDefault(); if (canAssign && !pending) void update("assignment"); }} className="mt-5">
                    <label htmlFor="assigned-staff" className="mb-2 block text-sm font-medium text-slate-700">Assigned staff member</label>
                    <select id="assigned-staff" value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} disabled={staffLoading || !!staffError || !!pending} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:opacity-60">
                        <option value="" disabled>{staffLoading ? "Loading staff..." : "Select a staff member"}</option>
                        {quote.assigned_user && !staff.some((member) => member.id === quote.assigned_user_id) && (
                            <option value={quote.assigned_user.id} disabled>{quote.assigned_user.name}</option>
                        )}
                        {staff.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.email})</option>)}
                    </select>
                    {staffError && (
                        <div role="alert" className="mt-2 text-sm text-red-700">
                            <p>{staffError}</p>
                            <button type="button" onClick={() => setStaffRefresh((value) => value + 1)} className="mt-1 cursor-pointer underline">Retry staff list</button>
                        </div>
                    )}
                    {!staffLoading && !staffError && staff.length === 0 && <p className="mt-2 text-sm text-slate-500">No staff members are available.</p>}
                    <button type="submit" disabled={!canAssign || !!pending} className="mt-3 w-full cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                        {pending === "assignment" ? "Saving assignment..." : "Save assignment"}
                    </button>
                </form>
            )}
            <div className="mt-5 border-t border-slate-100 pt-5">
                <h4 className="text-sm font-medium text-slate-700">Update status</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                    {allowedStatuses.map((status) => (
                        <button key={status} type="button" onClick={() => void update("status", status)} disabled={!!pending} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                            Mark as {statusLabels[status]}
                        </button>
                    ))}
                </div>
                {pending === "status" && <p role="status" className="mt-2 text-sm text-slate-500">Updating status...</p>}
                {allowedStatuses.length === 0 && (
                    <p className="text-sm text-slate-500">{quote.status === "closed" ? "This quote is closed. No further status changes are available." : "Only an Admin or the assigned staff member can update this quote."}</p>
                )}
            </div>
            {isAdmin && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                    <button type="button" disabled={!!pending} onClick={() => { setDeleteError(""); deleteDialog.current?.showModal(); }} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40">Delete quote</button>
                    <dialog ref={deleteDialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={(event) => { if (pending === "delete") event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
                        <h3 id="delete-title" className="text-lg font-semibold text-slate-900">Delete quote #{quote.id}?</h3>
                        <p id="delete-description" className="mt-3 text-sm text-slate-600">This will remove the request from the dashboard. You cannot restore it from this screen.</p>
                        {deleteError && <p role="alert" className="mt-3 text-sm text-red-700">{deleteError}</p>}
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" autoFocus disabled={pending === "delete"} onClick={() => deleteDialog.current?.close()} className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40">Cancel</button>
                            <button type="button" disabled={pending === "delete"} onClick={() => void remove()} className="cursor-pointer rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{pending === "delete" ? "Deleting..." : "Confirm deletion"}</button>
                        </div>
                    </dialog>
                </div>
            )}
        </section>
    );
}
