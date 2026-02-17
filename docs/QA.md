# QA Checklist — Club Dallas POS Upgrade

This QA script mirrors the automated tests and is intended for on-device validation (iPad + Honeywell keyboard-wedge scanner).

---

## 1) Language preference

- **Setup**:
  - Have an existing customer record in `customers` with `primary_language` unset.
  - Ensure employee-kiosk and customer-kiosk are connected to the same lane.

- **Steps**:
  - In employee-kiosk, **manually select a customer** (search + confirm).
  - On customer-kiosk, confirm the session starts in **English by default** (no language selection step).
  - Tap the **language toggle button** on the kiosk screen to switch to Spanish.
  - Verify the kiosk UI updates to Spanish immediately.
  - In employee-kiosk, open the customer profile and use the **preferred language button** to change language.

- **Expected**:
  - **No language selection step** at the start of the checkin flow.
  - Language defaults to English for all new sessions.
  - The on-screen toggle and employee profile button allow switching to Spanish.
  - Once `primary_language` is saved, future sessions for the same customer respect the saved preference.

---

## 2) Scan Mode input capture (Honeywell keyboard-wedge)

- **Setup**:
  - Connect Honeywell scanner via the mount USB hub.
  - Ensure no text input field is focused.

- **Steps**:
  - In employee-kiosk, tap **Scan** to open full-screen Scan Mode.
  - Scan a barcode that ends with **Enter** suffix.
  - Scan a barcode that does **not** send Enter/Tab (idle timeout termination).
  - Scan a multi-line PDF417 (state ID) and confirm the captured data is handled (no truncation at first newline).
  - Press **Cancel**.

- **Expected**:
  - Scanner keystrokes do **not** type into random fields outside Scan Mode.
  - Scan Mode shows **Scanning…** then **Processing…** on capture.
  - Enter/Tab or timeout reliably terminates a scan.
  - Multi-line scans are preserved (PDF417).
  - Cancel always exits Scan Mode cleanly.

---

## 3) Matching logic (backend)

Test each match type using known fixtures:

- **ID scan matches by `id_scan_hash` / `id_scan_value`**:
  - Scan the same state ID twice.
  - Expected: second scan should **instantly match** the existing customer.

- **Membership barcode matches by membership id**:
  - Scan a membership identifier that exists in `customers.membership_number`.
  - Expected: customer matches and opens.

- **Fallback name + DOB enrich**:
  - Start with a customer that has `name` + `dob`, but no `id_scan_hash/value`.
  - Scan that customer's state ID.
  - Expected: customer matches via name+DOB and the system **writes** `id_scan_hash/value` so the **next** scan matches instantly.

---

## 4) Agreement sync (kiosk → employee-kiosk)

- **Setup**:
  - Create a lane session that reaches the agreement step (selection locked + payment marked PAID).

- **Steps**:
  - On customer-kiosk, sign agreement and submit.
  - Observe employee-kiosk without refreshing.
  - On customer-kiosk complete screen, tap **OK**.

- **Expected**:
  - Employee-register updates to show **Agreement signed** within seconds (via `SESSION_UPDATED`).
  - No manual refresh required.
  - Kiosk returns to **idle** (logo-only), ready for next customer.
