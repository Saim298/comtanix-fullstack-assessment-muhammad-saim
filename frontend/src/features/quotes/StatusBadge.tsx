import { statusLabels, statusStyles } from "./quotePresentation";
import type { QuoteStatus } from "./types";

export default function StatusBadge({ status }: { status: QuoteStatus }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusStyles[status]}`}>
            {statusLabels[status]}
        </span>
    );
}
