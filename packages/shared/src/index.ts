// Enums
export { RoomStatus, RoomType, BlockType, CheckinMode, RentalType } from './enums.js';

// Transition validation
export { isAdjacentTransition, validateTransition, type TransitionResult } from './transitions.js';

// Checkout display helpers
export {
  computeCheckoutDelta,
  formatCheckoutDelta,
  type CheckoutDelta,
  type CheckoutDeltaStatus,
} from './checkoutDelta.js';

// Types
export type {
  Room,
  Locker,
  InventorySummary,
  DetailedInventory,
  RealtimeEventType,
  RealtimeEvent,
  CheckinOptionHighlightedPayload,
  RoomStatusChangedPayload,
  InventoryUpdatedPayload,
  SessionUpdatedPayload,
  CustomerIdType,
  Visit,
  CheckinBlock,
  ActiveVisit,
  CheckoutRequestStatus,
  CheckoutChecklist,
  ResolvedCheckoutKey,
  CheckoutRequestSummary,
  CheckoutRequestedPayload,
  CheckoutClaimedPayload,
  CheckoutUpdatedPayload,
  CheckoutCompletedPayload,
  AssignmentCreatedPayload,
  AssignmentFailedPayload,
  CustomerConfirmationRequiredPayload,
  CustomerConfirmedPayload,
  CustomerDeclinedPayload,
  SelectionProposedPayload,
  SelectionForcedPayload,
  SelectionLockedPayload,
  SelectionAcknowledgedPayload,
  WaitlistCreatedPayload,
  UpgradeHoldAvailablePayload,
  UpgradeOfferExpiredPayload,
  CashDrawerSessionStatus,
  CashDrawerEventType,
  StaffBreakStatus,
  StaffBreakType,
  OrderStatus,
  OrderLineItemKind,
  ExternalProviderEntityType,
  CashDrawerSession,
  CashDrawerEvent,
  StaffBreakSession,
  Order,
  OrderLineItem,
  Receipt,
  ExternalProviderRef,
  RegisterSessionUpdatedPayload,
} from './types.js';

// Membership helpers (shared business logic)
export type { CustomerMembershipStatus, MembershipStatusInput } from './membership.js';
export { getCustomerMembershipStatus } from './membership.js';

// Zod schemas
export {
  RoomStatusSchema,
  RoomTypeSchema,
  RoomSchema,
  RoomStatusUpdateSchema,
  InventorySummarySchema,
  BatchStatusUpdateSchema,
  CustomerIdTypeSchema,
  IdScanPayloadSchema,
  type RoomInput,
  type RoomStatusUpdateInput,
  type InventorySummaryInput,
  type BatchStatusUpdateInput,
  type IdScanPayload,
} from './schemas.js';

// Realtime runtime validation
export {
  safeParseRealtimeEvent,
  type ParsedRealtimeEvent,
  SessionUpdatedPayloadSchema,
  InventoryUpdatedPayloadSchema,
  UpgradeHoldAvailablePayloadSchema,
  UpgradeOfferExpiredPayloadSchema,
} from './realtimeSchemas.js';

// Facility inventory contract (rooms + lockers)
export {
  LOCKER_NUMBERS,
  EXPECTED_LOCKER_COUNT,
  NONEXISTENT_ROOM_NUMBERS,
  ROOM_NUMBERS,
  ROOM_NUMBER_SET,
  EXPECTED_ROOM_COUNT,
  ROOMS,
  DOUBLE_ROOM_NUMBERS,
  SPECIAL_ROOM_NUMBERS,
  isDoubleRoom,
  isSpecialRoom,
  isExistingRoomNumber,
  getRoomTierFromNumber,
  type RoomTier,
} from './inventory.js';

// Agreement content (built-in HTML used by kiosk + PDF generation)
export { AGREEMENT_LEGAL_BODY_HTML_BY_LANG, type AgreementLanguage } from './agreementContent.js';

// Realtime helpers live in subpath exports to avoid server-side React deps.
// Use @club-ops/shared/realtime/* in browser apps.

// API base helpers for frontend apps
export { API_BASE_URL, getApiUrl } from './apiBase.js';

// Browser storage keys + migration helpers
export {
  CLUBOPS_STORAGE_KEYS,
  CLUBOPS_STORAGE_LEGACY_KEYS,
  readStorageValueWithMigration,
  writeStorageValue,
  clearStorageValue,
  type StorageLike,
} from './storageKeys.js';
