# Comtanix Postman technical review

Import `Comtanix.postman_collection.json` and `Comtanix.local.postman_environment.json`, then select **Comtanix - Local Review (template)**. The collection contains 32 requests across eight folders and 42 saved response examples.

Every saved response is **illustrative, not verified against a running API**. Bodies and status codes follow the current controllers, resources, and service schemas. Quote IDs 201–204, user IDs 1–3, UUIDs, timestamps, pagination URLs, and result counts are fictional examples. Requests capture real IDs and tokens from successful responses; the environment intentionally starts with blank IDs and secrets.

## Local setup

Use the existing Laravel and Node services and existing seeded accounts. This documentation does not run migrations, seeders, or database updates. Default URLs are `http://127.0.0.1:8000/api` for Laravel and `http://127.0.0.1:4001` for Node; adjust the environment to match your local services. Do not add a trailing slash.

Supply passwords as local Postman environment values:

| Account | Seeded email | Password variable | Seeder configuration |
| --- | --- | --- | --- |
| Assessment Admin | admin@comtanix.test | `admin_password` | `ASSESSMENT_ADMIN_PASSWORD` |
| Staff One | staff1@comtanix.test | `staff_one_password` | `ASSESSMENT_STAFF_ONE_PASSWORD` |
| Staff Two | staff2@comtanix.test | `staff_two_password` | `ASSESSMENT_STAFF_TWO_PASSWORD` |

Use each account's current password. `StaffUserSeeder` sets a password only when creating an account, so a later environment change does not necessarily change an existing account's password. The seeder requires configured passwords of at least 12 characters; the login validator itself requires a nonempty string. No passwords are included in the collection or environment export.

For audit history through Laravel, configure the services with matching `AUDIT_SHARED_SECRET` and `AUDIT_READ_TOKEN`, set Laravel's `AUDIT_SERVICE_URL`, and run its queue worker. For the direct Node requests, set Postman's `audit_read_token`; optional signed writes also need `audit_shared_secret`. Keep populated secrets and captured bearer tokens out of committed or shared exports.

The signing scripts use the [Postman sandbox's Web Crypto objects](https://learning.postman.com/v11/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-require). Optional requests use [pm.execution.skipRequest](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/). Use a Postman runtime that supports these APIs; CLI and Newman execution have not been verified.

## Review workflow

Run folders in their numbered order, with one iteration:

1. **Public client inquiries:** creates the four fictional inquiries and captures their IDs. Saim's ID also becomes `quote_request_id` for management requests.
2. **Seeded account login:** logs in the admin and both staff accounts, storing separate tokens and user IDs.
3. **Admin review and assignment:** reads the staff directory, discovers IDs by seeded email, explores filters, assigns Saim's website to Staff One, and moves it from `new` to `in_review`.
4. **Assigned staff workflow:** Staff One reads the brief, moves it from `in_review` to `quoted`, and reads status-change history.
5. **Admin completion:** moves the proposal from `quoted` to `closed`.
6. **Node audit service:** reads events directly. Three synthetic write requests are skipped unless `enable_direct_audit_writes=true`.
7. **Optional soft deletion:** skipped unless `enable_quote_delete=true`. Review the captured ID before enabling it.
8. **Logout:** revokes the three tokens created by the login folder and clears each token after successful logout.

Sending the collection creates four new quotes and login tokens and updates the selected Saim quote. Re-running the public folder creates additional quotes; submissions are not idempotent. This workflow changes no seeded quotes when used with its freshly captured Saim ID. A failed Saim submission clears that ID to prevent subsequent requests from using a previous run's value. Missing prerequisite variables cause requests to be skipped with an explanatory script error.

Public submissions and login each have a five-per-minute throttle per IP. Wait for the rate limit to reset before repeating a folder. Audit delivery is queued, so a successful history response can initially contain no events. Re-send a history request after the worker processes its jobs.

The status sequence is intentional. Repeating a transition after it succeeded returns 422; run a fresh public submission to restart the workflow. The saved repeated-close response documents this behavior without adding a failing request to the default run.

## Fictional client briefs

| Client | Company | Service | Allowed budget value | Fictional email |
| --- | --- | --- | --- | --- |
| Saim Arifeen | Saim Digital Solutions | Web Development | `1000_5000` | saim.arifeen@test.com |
| Ayesha Khan | Ayesha Artisan Boutique | E-commerce Development | `5000_10000` | ayesha.khan@test.com |
| Ahmed Raza | Raza Logistics Solutions | Mobile Application Development | `above_10000` | ahmed.raza@test.com |
| Sara Malik | Malik Retail Operations | API Integration | `under_1000` | sara.malik@test.com |

Client names, companies, messages, and contact addresses are illustrative. The requested `test.com` email addresses are placeholders; no ownership or deliverability is implied, and the documented endpoints do not send email. Login emails retain the actual seeders' `comtanix.test` domain so authentication targets the correct accounts.

## Exact Laravel input rules

| Input | Rules |
| --- | --- |
| `client_name` | Required string, maximum 150 characters |
| `email` | Required RFC-valid email, maximum 255 characters |
| `company` | Nullable string, maximum 150 characters |
| `service_type` | Required string, maximum 100 characters; no enum |
| `budget_range` | Required; `under_1000`, `1000_5000`, `5000_10000`, `above_10000`, or `not_sure` |
| `message` | Required string, 10–5000 characters |
| Public server-controlled fields | `website`, `status`, `assigned_user_id`, `id`, `created_at`, and `updated_at` are prohibited; public sample bodies omit them |
| Login | Required RFC-valid `email`, maximum 255 characters; required string `password` |
| Assignment | Required integer `assigned_user_id` referencing an existing user with role `staff` |
| Status update | Required `status`: `new`, `in_review`, `quoted`, or `closed`, plus the transition rules below |

Public creation returns 201 with a `data` wrapper. Its `assigned_user` relation is omitted because it is not loaded. Detail, list, assignment, and status responses load this relation and return an object or null. No extra `success` field or creation message is fabricated.

Quote list filters follow `ListQuoteRequestsRequest`:

- `search`: optional, nullable string, maximum 150 characters; matches client name, email, or company.
- `status`: optional, nullable member of the four allowed statuses.
- `assigned_user_id`: optional, nullable existing user ID; prohibited when `unassigned=1`.
- `unassigned`: optional Laravel boolean; the requests use `0` or `1`.
- `service_type`: optional, nullable string, maximum 100 characters; substring match.
- `sort_by`: optional `id`, `created_at`, `client_name`, or `status`.
- `sort_direction`: optional `asc` or `desc`.
- `per_page`: optional integer, 1–100; defaults to 20.

The paginator uses `page`; `ListQuoteRequestsRequest` does not declare a page rule. Examples use the default first page. Audit history validates `page` as an integer of at least 1 and `per_page` as 1–100. Its optional `type` must be one of the three audit event types.

Allowed transitions are `new → in_review`, `in_review → quoted`, `in_review → closed`, and `quoted → closed`. Closed quotes cannot transition. Admins can assign, delete, list staff, and change statuses. Staff can read quotes and history, and can change status only on quotes assigned to them.

## Node audit schema and signing

`eventSchema` accepts exactly these top-level fields:

| Field | Schema |
| --- | --- |
| `eventId` | UUID string |
| `type` | `quote.created`, `quote.assigned`, or `quote.status_changed` |
| `quoteRequestId` | Positive integer |
| `actorId` | Required positive integer or null; public creation uses null |
| `data` | Object with string keys and arbitrary values |
| `occurredAt` | ISO datetime with a timezone; examples use UTC |

The object is strict. Request bodies cannot contain `receivedAt`, descriptions, or other extra top-level fields. `receivedAt` is generated by Mongoose and appears in read responses. Read responses exclude MongoDB `_id` and include `data` and pagination `meta`; they do not use Laravel's pagination `links`.

The publisher's metadata is preserved exactly:

- `quote.created`: `serviceType` and `budgetRange`.
- `quote.assigned`: `oldAssignedUserId` and `newAssignedUserId`.
- `quote.status_changed`: `oldStatus` and `newStatus`.

Human-readable event explanations appear in request descriptions, rather than adding fields to the API payload. The Zod schema permits arbitrary metadata values, while these examples deliberately follow Laravel's actual publisher.

`POST /events` requires `Content-Type: application/json` and a hexadecimal HMAC-SHA256 `X-Signature` over the exact UTF-8 request bytes. Pre-request scripts generate a UUID and timestamp into local variables, resolve the body, and sign those same bytes. They do not change the request body after signing. Raw bodies remain visible for review, with integer IDs unquoted.

Signed writes are synthetic demonstrations, disabled by default because normal Laravel actions already publish events. A new send generates a new event ID and expects 201. Node returns 200 with `Event already processed.` only when the same event ID is replayed; the saved retry examples show a fixed illustrative payload. To test replay manually, freeze both the UUID and timestamp in the script, then send the same signed request twice and expect 200 on the second send. The saved 200 response is not a claim that a default second send is a retry.

`GET /events` requires `X-Audit-Read-Token`. Its optional filters are positive integer `quoteRequestId` and one of the allowed `type` values; `page` defaults to 1 and must be at least 1, and `per_page` defaults to 20 and must be 1–100. Laravel history uses its server-configured read token, so Postman's direct-read token is unnecessary for that proxy request.

## Verification scope

Completed locally against the checked-out backend sources:

- Official [Postman Collection v2.1 JSON schema](https://schema.getpostman.com/json/collection/v2.1.0/collection.json) validation of the complete collection.
- Actual Laravel form rules for 15 request bodies/filter sets, with assignment existence checked against synthetic staff in an isolated in-memory SQLite database. Login password fixtures were generated only for validation and were not exported.
- Actual Node Zod input-schema validation of all three signed request bodies and the illustrative audit payloads.
- Script execution with source-derived mock responses: 57 assertions, capture and cleanup behavior, four optional requests skipped by default, and missing-prerequisite handling.
- Independent HMAC comparison against Node `createHmac` for all three signed bodies.
- JSON parsing of all 42 saved examples and confirmation that exported secret variables are blank.

These checks are not live API verification or a Postman application import/run. No requests were sent to running services, no existing database records were changed, and no seeders were run or edited. Assignment IDs, token validity, service availability, actual pagination totals, and queued audit delivery must be verified against the reviewer's local API. The temporary build and verification tools are not part of the delivered package.

The source contracts are `api-laravel/routes/api.php`, `app/Http/Requests`, `app/Http/Controllers`, `app/Http/Resources`, `app/Services`, `app/Policies`, and `database/seeders/StaffUserSeeder.php`, plus `audit-service/src/schemas/eventSchema.ts`, `models/AuditEvent.ts`, `controllers/eventController.ts`, and the audit authentication middleware.
