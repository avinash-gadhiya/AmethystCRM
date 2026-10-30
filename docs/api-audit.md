# CRM API audit — 30 October 2026

Source: [the supplied Swagger UI](https://demoapi.enstasol.com/swagger/index.html) and its [OpenAPI JSON](https://demoapi.enstasol.com/swagger/v1/swagger.json).

The downloaded contract contains **196 operations**. The API workspace catalog covers every operation exactly. The generated `src/services/catalog/crmApiContract.json` records the documented query names, JSON body fields, and multipart upload fields. Swagger does not publish the application's permission-code requirements.

## Corrections

| Area | Change |
| --- | --- |
| Orders and Payments permissions | Orders accepts the granted `View_Payments` code from `/Orders/Payments` for payment viewing. Refund, void, edit, and delete controls retain their own checks. |
| Order expansion | Clicking the row or arrow opens the payment actions below the order. Clicking an action does not toggle the row again. Payment history loads when expanded and refreshes for the active order after changes. |
| Payment history and refunds | Uses the same paginated `/Payment` collection as the Payments page, rather than assuming `View_Payment` access to `/Payment/GetAllPayment`. Filters exact order IDs, reads every history page, and checks fresh refund history before saving. |
| Order dates and summaries | Converts quick dates to inclusive date bounds, sends `fromDate`/`toDate`, and sends only the date parameters supported by `/Order/GetOrderSummary`. |
| Missing detail routes | Menu, Page, Template, and Group Email detail loaders find the exact ID through their documented collection endpoints instead of calling nonexistent `/{id}` URLs. |
| Delete requests | Brand Email and Gateway Payment Type use their documented query `id`. Removed unsupported Lead, Product, Setting, and UserGroup fallback requests. |
| Gateway mapping | Uses the API's documented `getwayId` spelling and the documented JSON DTO fields; authorization failures propagate instead of becoming a successful empty list. |
| Settings and lookups | Sends supported query fields. Settings pagination and sorting run locally because these endpoints do not accept paging parameters. State results continue to be filtered by country locally. |
| Dashboard | Uses each endpoint's date parameter names without duplicate case variants or unsupported paging/search fields. |
| API workspace | Uses endpoint-specific query defaults, validates body containers and field names, sends bodyless requests without synthetic JSON, and supports refund Excel uploads and ticket multipart fields/attachments. Mail-sending GET operations are excluded from bulk read tests. |

## Verification and limits

- The static inventory found no undocumented CRM routes or unsupported query fields among the calls it could resolve. Dynamic wrappers still require runtime/service coverage.
- All **152 regression tests pass**. Tests intercept actual service requests and check route, query, and selected DTO contracts. Order tests cover row expansion, permissions, payment/refund actions, retries, and card-number masking.
- The production build succeeds.
- Live probes exercised **79 read-only routes**. All returned **401 Unauthorized** because the shell has no signed-in test token. These are reachability checks, not authenticated feature passes. Authenticated CRUD, account-specific grants, mail delivery, and live browser rendering remain unverified.

## Reproduce

Download the OpenAPI JSON to a local file, then run:

```powershell
node scripts/generate-api-contract.cjs path/to/swagger.json
node scripts/audit-api-contracts.cjs path/to/swagger.json report.json
node --test scripts/api-contract.test.cjs scripts/order-api.test.cjs scripts/payment-flow.test.cjs
npm run build
```

For live read checks, make `AMETHYST_API_TEST_TOKEN` available locally and run `node scripts/probe-api-reads.cjs report.json`. The probe records HTTP statuses, omits CRM response bodies and token values, and excludes mutations and mail-sending routes.
