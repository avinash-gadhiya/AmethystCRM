# Customer profile investigation

Checked against the live Swagger at https://demoapi.enstasol.com/swagger/v1/swagger.json.

`POST /api/Customer` and `PUT /api/Customer` both accept CustomerDTO as a JSON object. The frontend sends its contact, address, country/state IDs and names, salesPerson and salesPersonName fields directly on this object. Related order and ticket arrays are empty when creating a customer.

The supplied authenticated `GET /api/Customer/13` response reports success but contains empty email, phone, phone2, address, city, stateName, countryName, zipCode, and salesPersonName. Its stateId, countryId, salesPerson and leadId are zero. createdDate is null, createdBy is zero, and isActive is false. The embedded order #43 is present, with status Full Payment and amount 399.99. The customer list screenshot supplies a creation date that is missing from this detail response.

This confirms that the blank profile fields are present in the API response. It does not prove whether POST omitted the values, persistence lost them, or the GET projection omitted persisted fields. The second supplied JSON was Swagger's placeholder example, not an actual form submission. No backend source or signed-in API token is available in this workspace.

Follow-up evidence: the supplied response from `PUT /api/Customer/CanDisableCustomer?id=13` contains Nelson's stored email, phone numbers, street address, city, stateId 27, countryId 1 and salesPerson 34. Its isActive remains false. The accompanying Customer list still omits those profile fields. This establishes that customer #13's profile is stored but omitted by the list/detail projections; the earlier uncertainty about whether those fields were persisted is resolved for this record.

The supplied `GET /api/Customer/search?searchText=n&pageNumber=1&pageSize=10` response restores email and both phone numbers for the matching customers, but contains no address, city, state, country or salesPerson properties. Search therefore cannot supply those table columns. Sparse rows now merge available search contacts by exact customerId using GET only, preserve the list's current status and metadata, and report missing profile fields rather than implying a formatting change recovered them. No status-changing endpoint is used to populate the list.

The supplied `GET /api/Order/GetCustomerOrders?customerId=13` response contains orderNumber, orderDate, amounts, brandName, brandId and orderStatus only. It contains no customer profile or assigned customer sales person. The frontend does not call this route to fill those columns and does not substitute an order's seller for the customer's assigned owner.

The supplied `GET /api/Order/43` response is an array containing getOrderListDTO fields: orderId, paymentDate, orderDate, customerName, brandName, gatewayName, salesPersonName, amounts, orderStatus and payments. There is no nested customer object, customer address, state/country ID or assigned customer salesPerson ID. Its salesPersonName is also empty. The order editor's optional support for a nested customer object does not mean this backend actually returns one. No order-detail fallback is added to the Customers list.

Browser verification: Swagger was rendered in an isolated local Chrome session. The Customer section and GET /api/Customer parameter panel were expanded and inspected. The browser session had no authorization; the authenticated response examples above were supplied by the user. Swagger does not define response schemas for these GET operations, so the CustomerDTO write schema cannot be treated as a guarantee that the GET responses include its fields.

Required backend correction: map the persisted customer's city, stateId, countryId and salesPerson into the existing CustomerDTO returned by GET /api/Customer and GET /api/Customer/{id}. Populate stateName, countryName and salesPersonName when available, or retain the actual nonzero foreign-key IDs so the frontend's existing dropdown lookups can resolve names. Include stored email, phone, phone2, address and zipCode as well. Keep current isActive and creation metadata. For customer #13, the provided mutation response proves city and these foreign keys exist; the GET responses replace them with empty strings/zeros. No supplied read-only endpoint has returned that profile. Backend implementation is required to repair the missing fields across page reloads.

Activation now uses this full status-operation response as the source for an explicit `PUT /api/Customer` with isActive true. Unrelated stored DTO values, including nullable metadata and related collections, are preserved. A partial profile is never used for this update. Deactivation uses CanDisableCustomer directly. Both actions read the list's actual isActive value to confirm the outcome, and failures appear beside the switch. Repeated clicks are blocked while the request is pending. This sequence is necessary because the documented status operation accepts only id and the observed response leaves the customer inactive.

To finish the backend diagnosis, compare the actual POST request body, the persisted customer row and GET /api/Customer and GET /api/Customer/13 projections for the same ID. If the row contains the submitted values, correct both GET projections to map the full CustomerDTO. If the submitted values are missing from the row, inspect the POST/PUT mappings and persistence. Preserve existing values during partial updates. Do not substitute createdBy for the assigned sales person.

Frontend changes:

- Local Vite requests use a same-origin /crm-api proxy that preserves the configured upstream /api path, query strings, authorization and JSON bodies. Production build API configuration is unchanged.
- CustomerDTO embedded collections are used before requesting separate collections. Missing collections still use customer-filtered endpoints.
- Successful responses with empty optional profile fields do not trigger a load-failure banner. Only actual supporting request failures offer a refresh/retry. This corrects the earlier repeated warning; it does not reconstruct fields omitted by the backend.
- Existing foreign-key IDs can resolve to names through the documented User, State and Country dropdown endpoints. Missing IDs are never invented.
- Customer saves are read back from detail and list APIs. A POST echo alone cannot confirm persistence. An incomplete read-back produces a separate warning, retains the form entries and created ID, and offers Done. Unchanged data cannot be submitted again. Editing the retained fields allows a PUT to the same customer rather than another POST. Actual write failures remain errors.

Restart the local Vite server after pulling these configuration changes. Customer #13's missing values cannot be reconstructed from the supplied response alone.

Customer profile display follow-up:

- The table now includes the stored street address and ZIP code, which the previous compact cell intentionally excluded.
- Profile fields learned from successful reads, saves or explicit status operations are retained by exact customer ID for the current login in this tab. Sparse list/search/detail responses no longer erase them after activation, refresh or navigation. The cache never supplies isActive or creation metadata, is isolated by API/user/login, and is cleared on logout and customer deletion. Explicit edits replace cached values, including cleared fields. Save verification bypasses this display cache so a write echo cannot be mistaken for a persisted read-back.
- User, state and country dropdown labels also recognize id/value and label/text response fields alongside the entity-specific keys.
- These changes keep the existing HTTP endpoints, methods, parameters and write payloads. Loading the page never calls CanDisableCustomer to obtain profile data. Customers whose stored profiles have never been returned to this tab still require the backend GET projection correction described above. Session retention cannot reconstruct information absent from every read-only response.
