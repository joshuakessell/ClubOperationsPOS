# Postman collections

## Employee Register debug

Files:

- `docs/postman/employee-register-debug.postman_collection.json`
- `docs/postman/employee-register-debug.postman_environment.json`

Usage:

1. Import both JSON files into Postman.
2. Select the **Employee Register (Debug)** environment.
3. Set environment variables:
   - `baseUrl` (defaults to `https://api-demo.joshuakessell.com`)
   - `kioskToken` (resolved from AWS Secrets Manager secret referenced by `KIOSK_TOKEN_SECRET_ARN`)
   - `staffToken` (copied from browser localStorage key `clubops.staffSession` → JSON field `sessionToken`)
   - `deviceId` (whatever the iPad/browser is using; can be any string for status/heartbeat)
   - `laneId` (defaults to `lane-1`)
   - `roomId` / `lockerId` (UUIDs for assignment testing)

Notes:

- `Waitlist` endpoints require `staffToken` and will return `401` if missing/expired.
- `Inventory Available` does not require auth.
- `Realtime Auth` accepts either `x-kiosk-token` or `Authorization` (staff bearer). If both are set, either can satisfy auth.
