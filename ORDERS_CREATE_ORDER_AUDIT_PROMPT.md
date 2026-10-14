# Prompt: Audit and Properly Fix the Existing Orders / Create Order Feature

You are working inside an existing React CRM project. The Orders and Create Order pages already exist. Do **not** rebuild them from scratch, replace them with mockups, or create parallel pages. Analyze the current implementation completely, identify incorrect behavior and API integration, and repair it in place.

The result must preserve the intended AmethystCRM design shown in the supplied screenshot while making every section, workflow, permission check, request, payload, and response adapter correct.

## 1. Objective

Properly audit and fix:

- `src/pages/order/OrdersPage.jsx`
- `src/pages/order/CreateOrderPage.jsx`
- `src/pages/order/table/OrdersTable.jsx`
- `src/pages/order/ProductsPage.jsx`
- `src/pages/order/PaymentsPage.jsx`
- `src/pages/order/table/ProductsTable.jsx`
- `src/pages/order/table/PaymentsTable.jsx`
- All services, hooks, shared components, styles, and routes used by those files

The implementation must use the real backend. Do not add mocked rows, placeholder handlers, fake success responses, hardcoded IDs, hardcoded tokens, or hardcoded API hosts.

## 2. Required Analysis Before Editing

Read every relevant file completely before making changes. Do not infer an API contract from button labels or component state. Trace each action from UI handler to service method to HTTP request and response normalization.

Create an audit matrix before editing with these columns:

| Area | UI action | Permission required | Current handler | Service method | HTTP request | Expected payload/params | Response usage | Defect found | Planned fix |
|---|---|---|---|---|---|---|---|---|---|

At minimum, audit:

- Orders list and summary loading
- Search-field behavior and date filters
- Sorting, pagination, refresh, and stale-request protection
- Expand/collapse payment rows
- Add, edit, void, refund, share, email, and delete actions
- New Order, Edit Payment, Add Payment, Customer-preselected, and Lead-origin modes
- Products, custom product, discounts, subscription, payment, customer, sales person, Share Sale, notes, receipt, and final submission sections
- Permission visibility and permission enforcement inside mutation handlers
- Every loading, empty, saving, success, and error state

Inspect these dependencies completely:

- `src/services/orderService.js`
- `src/services/paymentService.js`
- `src/services/productService.js`
- `src/services/customerService.js`
- `src/services/brandService.js`
- `src/services/gatewayService.js`
- `src/services/settingService.js`
- `src/services/clientIpService.js`
- `src/services/core/apiClient.js`
- `src/services/index.js`
- `src/lib/salesRoles.js`
- `src/lib/apiError.js`
- `src/lib/dynamicPaths.js`
- `src/hooks/usePageCrudPermissions.js`
- `src/hooks/usePagePermissionCodes.js`
- `src/hooks/useSearchFieldFetchGuard.js`
- All shared components imported by the order pages
- The order-related rules in `src/styles/globals.css`
- The order routes in `src/routes/MainRoutes.jsx`

Preserve unrelated user changes in this dirty working tree.

## 3. Known Defect That Must Be Fixed

`src/pages/order/CreateOrderPage.jsx` currently makes direct Axios requests using `API_URL` for:

- `GET /Customer/search`
- `POST /Customer/index/rebuild`

Remove these direct component-level requests. Use the existing authenticated service methods instead:

- `customerService.searchCustomers(searchText, 1, 10, signal)`
- `customerService.rebuildSearchIndex()`

All feature requests must go through the project's shared authenticated service/API client. Components must not construct API hosts, authentication headers, or raw endpoint URLs.

Search the complete order feature for any other direct `axios`, `fetch`, or duplicated request implementation and move it to the appropriate service.

## 4. Orders Page Sections

Repair the existing Orders page to match the screenshot and intended hierarchy.

### Header and filters

- Title: `Orders`
- Description: `Browse orders and payment details`
- Purple liquid-glass `Create Order` action
- Count display: `<visible rows> of <total> Orders`
- Search fields: All Orders, Customer, Brand, Sales Person, Card Number
- Brand and Sales Person must use searchable selects
- Other fields use debounced typed search
- Quick date filters: Today, Yesterday, Last Week, Current Month, Last Month, This Year, Last Year
- Default: Current Month
- Typed searches ignore date filters; Brand and Sales Person retain the chosen range
- Refresh must repeat the current query without resetting filters

### Summary cards

Render only when `View_Order_Summary` is granted:

- Total Order
- Sales Amount
- Refund Amount
- Order Fulfilled

The values must come from `/Order/GetOrderSummary`, not be calculated from the visible page.

### Main order row

Match the screenshot structure:

- Order ID with expand/collapse
- Customer name with secondary email and phone
- Brand with gateway below it
- Sales person with Share Sale recipients/amounts
- Payment total, paid amount, order status, and refund amount when applicable
- Date card containing payment and sale dates
- Permission-gated row actions

Default sorting must show the newest sale date first.

### Expanded payments table

Use these columns:

- Action
- Payment ID
- Payment Type with masked identifier and transaction ID
- Auth Code
- Date
- Brand & Gateway
- Amount
- Payment Status

Never log or display full card numbers, CVVs, credentials, or other sensitive payment data.

### Payment/order workflows

Audit and fix each independently:

- Add Payment
- Edit Payment
- Void Payment
- Create/Edit Refund
- Share Payment / Share Sale
- Send PandaDoc email
- Send selected brand email template
- Delete Payment
- Delete Order

Voided payments cannot be edited, refunded, or deleted. Every destructive action requires a confirmation modal. Every mutation handler must re-check its permission before calling the service; hiding a button is insufficient.

## 5. Create Order Page Modes

The existing page must support all modes without leaking validation or state between them:

1. New Order: no payment ID and no existing order ID
2. Edit Payment: query `id=<paymentId>` or navigation state containing `payment` and `isEditMode`
3. Add Payment: query `orderId=<orderId>` or navigation state containing `addPaymentMode` and `orderData`
4. Customer-preselected: query `customerId=<customerId>`
5. Lead-origin: query/state `leadId`; open Add Customer once, prefilled with the lead ID, only when permitted

Build one explicit mode resolver and verify the precedence. Edit Payment must win over Add Payment when both identifiers are present.

## 6. Create Order Sections

### Products

- Product dropdown and Browse Products modal
- 300 ms debounced server search
- Fresh new order auto-selects the first active product with quantity 1
- Quantity controls, editable unit price, line total, remove, selected count, clear-all, loading, empty, and validation states
- Creating a custom item requires `Add_Product` and the Product page add permission
- A custom item must call the real Product API before being added to the order
- Do not require or fetch products in Edit Payment or Add Payment mode

### Discounts

- Load `DiscountType` through `settingService`
- Default fresh orders to the option containing `Fixed`
- Support fixed and percentage values
- Clamp applied discount to `[0, subtotal]`
- Reduced product price creates automatic savings, forces Fixed, and generates `SAVE<rounded amount>`
- Lock auto-generated discount fields until the price savings are removed

### Subscription

- Presets: 3, 6, 9 ... 36 months plus Custom
- Custom must be a positive whole number
- Required only for new orders

### Payment Information

- Payment tabs in this order: Card, Bank, Cheque, Zelle, PayPal
- Gateway selection must resolve its authoritative brand from full Gateway data
- Filter gateways by selected brand where appropriate
- Load `/GatewayPaymentType` and allow only active payment methods assigned to the selected gateway
- Keep the selected option mounted while searchable selects filter their menus
- New-order payment amount equals the computed order total
- Edit Payment and Add Payment keep their API-provided amount
- Preserve mode pills and mode-specific save buttons

### Order Info sidebar

- Customer search requires nonblank input and uses a 350 ms debounce
- Use `customerService.searchCustomers`; never call Axios directly from the component
- Rebuild uses `customerService.rebuildSearchIndex`
- Customer detail, clear, Add Customer, and lead-preselection must respect permissions
- Sales Person selector is available only to normalized roles: superadmin, super admin, admin, developer, sales manager, service manager
- Other roles use the logged-in user
- Share Sale must reject incomplete rows, duplicate users, the primary sales person as a secondary split, and totals greater than the order total
- Main sales person receives the remainder
- Receipt must show items, quantity × unit price, subscription, subtotal, discount/code, and total

## 7. Validation

Only show required markers on fields that actually block saving.

### New Order

- Customer
- Sales person
- At least one item
- Every item quantity > 0
- Every item unit price > 0
- Subscription months > 0

### Every payment save

- Amount > 0
- Gateway selected
- Gateway maps to a brand
- Selected payment type is active/configured for that gateway

### Payment-type validation

- Card: at least 13 digits, card type, name, expiry exactly `MM/YY`, CVV at least 3 digits
- Bank: account-holder name, account number at least 4 digits, routing/IFSC
- Cheque: payee name, exactly 9-digit routing number, cheque number
- Zelle: Zelle ID and transaction ID
- PayPal: valid email/phone stored in `zelleId` for backend compatibility, plus transaction ID
- Non-card types require a valid payment date

Render inline errors and one useful summary toast. Focus or scroll to the first invalid section.

## 8. API Contract to Verify and Implement

Treat this list as the expected contract, but verify every call against the existing service implementation and real response before declaring completion.

### Orders

- `GET /Order` with `SearchField`, `Text`, `Date`, `FromDate`, `ToDate`, `PageNumber`, `PageSize`, `SortProperty`, `IsDescending`
- `GET /Order/GetOrderSummary` with the active summary filters
- `GET /Order/GetCustomerOrders` with `customerId`, `ip`
- `GET /Order/<orderId>` when full order detail is required
- `POST /Order` for new orders
- `PUT /Order` only for supported order updates
- `DELETE /Order?id=<orderId>`; do not change to `/Order/<id>`

### Payments

- `GET /Payment/<paymentId>`
- `POST /Payment` for standalone payment/refund creation
- `PUT /Payment` for updates and the existing-order Add Payment workflow if required by the backend
- `DELETE /Payment/<paymentId>`
- `GET /Payment/SendMail` with `paymentId`, `brandEmailTempleteId` (preserve `Templete`)
- `GET /Payment/SendPandaDocMail` with `paymentId`

### Share payments

- `GET /SharePayment` with `PaymentId`, `ShareWithId`, `ShareTypeId`
- `POST /SharePayment` with an array
- `PUT /SharePayment` with an array
- Delete fallbacks in order: `?id=`, then `?sharePaymentId=`, then path ID
- For a new order, send `sharePayments` as a top-level sibling of `payment`; do not issue a second creation request

### Lookups

- `GET /Product/ProductDropdown`
- `GET /Product`
- `POST /Product`
- `GET /Customer/search` through `customerService.searchCustomers`
- `POST /Customer/index/rebuild` through `customerService.rebuildSearchIndex`
- Existing Customer detail/create methods
- `GET /Brand/BrandDropDown`
- `GET /Gateway/GatewayDropdown`
- `GET /Gateway` for gateway-to-brand mapping
- `GET /GatewayPaymentType`
- `GET /SettingValue/SettingValueDropDown?settingKey=...` for `DiscountType`, `Card_Type`, `sales_share_type`, and `SaleTypes`
- Existing sales-user lookup helpers
- `getCurrentLoginIpv4()` for Share Sale audit fields

All requests must use the common response envelope `{ success, data, totalCount, message }`. Normalize casing and envelope variations in services/adapters, not throughout JSX.

## 9. New Order Payload Invariant

Before submission, construct and inspect the payload. It must contain:

- One `payment` object, never a `payments` array
- Top-level `sharePayments`
- Correct order totals
- Correct gateway-derived `brandId`
- Correct item quantities, effective prices, totals, and subscription months
- Backend-required zero/default fields
- Current user/audit fields without hardcoded IDs
- ISO-8601 dates

Add a pure payload builder if the current handler mixes calculations, validation, UI state, and transport. Do not send until validation succeeds.

## 10. Permissions

Preserve both page CRUD permissions and code-level gates:

- `canView`, `canAdd`, `canUpdate`, `canDelete`
- `View_Order`
- `View_Order_Summary`
- `View_Search_Bar`
- `View_Order_Payment`
- `Add_Order_Payment`
- `Update_Order_Payment`
- `Delete_Order_Payment`
- `Void_Order_Payment`
- `Refund_Order_Payment`
- `Save_Order`
- `Add_Product`
- `Add_Customer` and `AddCustomer`

Wait for permission loading before treating access as denied. Do not use role-name shortcuts as an API authorization bypass.

## 11. Routes and Integration

Keep the canonical routes:

- `/Orders`
- `/Orders/CreateOrder`
- `/Orders/Products`
- `/Orders/Payments`
- `/Customer`

Use dynamic paths where configured. Remove unnecessary duplicate case-variant routes only if doing so cannot break backend-provided navigation URLs. Ensure `/Orders/*` does not swallow the explicit Create Order, Products, or Payments routes.

## 12. Implementation Order

1. Produce the audit matrix and defect list.
2. Fix service methods, authentication usage, query casing, payload adapters, and error normalization.
3. Extract/test pure mode, calculation, validation, and payload-building logic where practical.
4. Fix Orders filters, summary, table rows, expanded payments, and actions.
5. Fix each Create Order section separately.
6. Fix permissions at visibility and handler levels.
7. Verify responsive layout and dark mode against the screenshot/current intended design.
8. Run focused lint checks and the production build.
9. Exercise real API flows when the authenticated local app is available.

Do not stop after compilation. Verify request URLs, methods, query names, request bodies, response data, refresh behavior, and visible success/error states.

## 13. Verification Checklist

- No direct Axios/fetch calls remain in order page components
- No hardcoded host/token/user/brand/gateway IDs
- Orders and summary requests use matching filters
- Older responses cannot overwrite newer searches
- Expand row shows the correct order's payments
- All payment actions call the intended endpoint and refresh affected data
- New Order, Edit Payment, and Add Payment validate different required fields correctly
- Gateway-to-brand inference works
- GatewayPaymentType restrictions match in both Orders and Create Order
- New order request contains `payment` and top-level `sharePayments`
- Destructive actions require confirmation
- Sensitive payment data remains masked and is never logged
- Desktop, tablet, mobile, light, and dark layouts remain usable
- Production build succeeds
- No new lint errors

## 14. Required Final Report

Report only evidence-backed results:

1. Root causes found
2. Files changed
3. Sections repaired
4. API endpoints/methods/params/payloads corrected
5. Permission fixes
6. Verification commands and results
7. Real API flows exercised and their outcomes
8. Any genuine remaining blocker, including the exact endpoint/status/message

Do not say “should work.” Do not declare success while any handler is mocked, skipped, or unverified.
