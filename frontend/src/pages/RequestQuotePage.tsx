import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { quotesApi } from "../features/quotes/quotesApi";
import { budgetOptions, createPublicQuoteSubmission, emptyPublicQuote, publicQuoteFields, validatePublicQuote } from "../features/quotes/publicQuoteForm";
import type { QuoteFieldErrors } from "../features/quotes/publicQuoteForm";
import type { PublicQuoteInput, PublicQuoteReceipt } from "../features/quotes/types";

export default function RequestQuotePage() {
    const [values, setValues] = useState(emptyPublicQuote);
    const [errors, setErrors] = useState<QuoteFieldErrors>({});
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [receipt, setReceipt] = useState<PublicQuoteReceipt | null>(null);
    const [submitQuote] = useState(() => createPublicQuoteSubmission(quotesApi.createPublic));
    const successHeading = useRef<HTMLHeadingElement>(null);
    const form = useRef<HTMLFormElement>(null);

    useEffect(() => { if (receipt) successHeading.current?.focus(); }, [receipt]);

    const update = (field: keyof PublicQuoteInput, value: string) => {
        setValues((previous) => ({ ...previous, [field]: value }));
        setErrors((previous) => ({ ...previous, [field]: undefined }));
    };

    const focusError = (fields: QuoteFieldErrors) => {
        const input = form.current?.elements.namedItem(Object.keys(fields)[0]);
        if (input instanceof HTMLElement) input.focus();
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const validation = validatePublicQuote(values);
        setErrors(validation);
        setMessage("");
        if (Object.keys(validation).length) {
            setMessage("Please check the highlighted fields.");
            focusError(validation);
            return;
        }
        setSubmitting(true);
        const result = await submitQuote(values);
        if (!result) return;
        setSubmitting(false);
        if (result.receipt) {
            setReceipt(result.receipt);
            setValues(emptyPublicQuote());
        } else {
            setErrors(result.error.fields);
            setMessage(result.error.message);
            focusError(result.error.fields);
        }
    };

    const inputStyle = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200 aria-invalid:border-red-500";

    return (
        <main className="min-h-screen bg-slate-100">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
                    <span className="text-xl font-semibold tracking-tight text-slate-900">Comtanix</span>
                    <Link to="/login" className="rounded text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4">Staff Sign In</Link>
                </div>
            </header>
            <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
                {receipt ? (
                    <section aria-labelledby="quote-success" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <h1 id="quote-success" ref={successHeading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-slate-900">Request received</h1>
                        <p role="status" className="mt-4 text-sm leading-6 text-slate-700">Your quote reference is <strong>#{receipt.id}</strong>. We have received your project requirements. Please keep this reference for your records.</p>
                        <button type="button" onClick={() => { setReceipt(null); setErrors({}); setMessage(""); }} className="mt-6 cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Submit another request</button>
                    </section>
                ) : (
                    <>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Request a quote</h1>
                        <p className="mt-3 text-sm leading-6 text-slate-600">Tell us about your project and the services you need. No account is required.</p>
                        <form ref={form} noValidate onSubmit={submit} aria-busy={submitting} className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                            <p className="mb-6 text-xs text-slate-500">Fields marked * are required.</p>
                            {message && <p role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
                            <fieldset disabled={submitting} className="min-w-0 disabled:opacity-70">
                                <legend className="sr-only">Project requirements</legend>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    {publicQuoteFields.map((field) => (
                                        <div key={field.name} className="min-w-0">
                                            <label htmlFor={field.name} className="mb-2 block text-sm font-medium text-slate-700">{field.label}{field.required ? " *" : " (optional)"}</label>
                                            <input id={field.name} name={field.name} type={field.type} required={field.required} maxLength={field.maxLength} autoComplete={field.autoComplete} placeholder={field.placeholder} value={values[field.name]} onChange={(event) => update(field.name, event.target.value)} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `${field.name}-error` : undefined} className={inputStyle} />
                                            {errors[field.name] && <p id={`${field.name}-error`} className="mt-2 text-sm text-red-700">{errors[field.name]}</p>}
                                        </div>
                                    ))}
                                    <div className="sm:col-span-2">
                                        <label htmlFor="budget_range" className="mb-2 block text-sm font-medium text-slate-700">Budget range *</label>
                                        <select id="budget_range" name="budget_range" required value={values.budget_range} onChange={(event) => update("budget_range", event.target.value)} aria-invalid={!!errors.budget_range} aria-describedby={errors.budget_range ? "budget_range-error" : undefined} className={inputStyle}>
                                            <option value="">Select a budget range</option>
                                            {budgetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                        </select>
                                        {errors.budget_range && <p id="budget_range-error" className="mt-2 text-sm text-red-700">{errors.budget_range}</p>}
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="message" className="mb-2 block text-sm font-medium text-slate-700">Project message *</label>
                                        <textarea id="message" name="message" required minLength={10} maxLength={5000} rows={6} value={values.message} onChange={(event) => update("message", event.target.value)} placeholder="Describe your goals, the work involved, and any requirements you would like us to consider." aria-invalid={!!errors.message} aria-describedby={`message-help${errors.message ? " message-error" : ""}`} className={`${inputStyle} resize-y`} />
                                        <p id="message-help" className="mt-2 text-xs text-slate-500">10–5,000 characters.</p>
                                        {errors.message && <p id="message-error" className="mt-2 text-sm text-red-700">{errors.message}</p>}
                                    </div>
                                </div>
                                <div className="hidden" aria-hidden="true">
                                    <label htmlFor="website">Website</label>
                                    <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} />
                                </div>
                                <button type="submit" disabled={submitting} className="mt-6 w-full cursor-pointer rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{submitting ? "Submitting..." : "Submit quote request"}</button>
                            </fieldset>
                            {submitting && <p role="status" className="mt-3 text-sm text-slate-500">Submitting your request. Please wait.</p>}
                        </form>
                    </>
                )}
            </div>
        </main>
    );
}
