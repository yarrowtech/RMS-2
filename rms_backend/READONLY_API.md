# Read-only integration API

Base path: `/api/readonly/v1`. Only GET is supported. This integration key grants
tenant-wide access to the selected fields of products, inventory, and stores.
Give it only to trusted server-side integrations; do not embed it in a browser.
It is independent of user login tokens and cannot authorize the app's write routes.

## Deployment configuration

Set these backend environment variables (unset means the API returns 503):

- `READONLY_API_KEY`: generate a strong random secret, e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
- `READONLY_TENANT_ID`: exact tenant ID to expose. Clients cannot override it.
- `READONLY_MONGODB_URI`: separate MongoDB user credentials for the existing `MONGODB_DB`.

Provision the MongoDB user in your database administration console with **only**
`find` privileges on `products`, `inventory`, and `stores` in that database
(a custom role), or the built-in `read` role on that database. Do not reuse the
application's write user. MongoDB permissions must be configured by the database
administrator; the API does not create users or verify the assigned role.
Use HTTPS. Rotate access by replacing the key and restarting the backend.
Restart after changing any integration configuration.

## Requests

Pass `X-API-Key: <secret>` on every request.

```sh
curl -H "X-API-Key: <secret>" "https://<backend>/api/readonly/v1/resources"
curl -H "X-API-Key: <secret>" "https://<backend>/api/readonly/v1/products?limit=50&q=shirt"
curl -H "X-API-Key: <secret>" "https://<backend>/api/readonly/v1/products/<MongoDB-object-id>"
```

Lists return `items` and `next_cursor`. Pass the cursor as `after` on the next
request, keeping the same search. `limit` defaults to 50 and is capped at 200.
`q` searches literal text in names, barcodes, or codes, depending on the resource.
Records must have an ObjectId `_id` and the configured `tenant_id`; legacy
records without tenant ownership are excluded. Fields are explicitly allowlisted
in `app/routes/readonly_routes.py`; credentials and user collections are excluded.
Pagination is ordered by ObjectId and is not a database snapshot.

401 means an invalid key, 404 an unknown resource or inaccessible record,
422 an invalid input, and 503 an unconfigured or unavailable connection.
The API is registered in the existing app and covered by its global rate limiter.
Interactive endpoint documentation is available at `/docs`.
