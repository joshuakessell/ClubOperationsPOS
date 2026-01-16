// Enums
export { RoomStatus, RoomType, BlockType, CheckinMode, RentalType } from './enums';

// Transition validation
export { isAdjacentTransition, validateTransition, type TransitionResult } from './transitions';

// Checkout display helpers
export { computeCheckoutDelta, formatCheckoutDelta, type CheckoutDelta, type CheckoutDeltaStatus } from './checkoutDelta';

// Types
export type {
  Room,
  Locker,
  InventorySummary,
  DetailedInventory,
  WebSocketEventType,
  WebSocketEvent,
  RoomStatusChangedPayload,
  InventoryUpdatedPayload,
  SessionUpdatedPayload,
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
  SelectionProposedPayload,
  SelectionForcedPayload,
  SelectionLockedPayload,
  SelectionAcknowledgedPayload,
  RegisterSessionUpdatedPayload,
} from './types';

// Membership helpers (shared business logic)
export type { CustomerMembershipStatus, MembershipStatusInput } from './membership';
export { getCustomerMembershipStatus } from './membership';

// Zod schemas
export {
  RoomStatusSchema,
  RoomTypeSchema,
  RoomSchema,
  RoomStatusUpdateSchema,
  InventorySummarySchema,
  BatchStatusUpdateSchema,
  IdScanPayloadSchema,
  type RoomInput,
  type RoomStatusUpdateInput,
  type InventorySummaryInput,
  type BatchStatusUpdateInput,
  type IdScanPayload,
} from './schemas';

// WebSocket runtime validation (Zod)
export {
  WebSocketEventTypeSchema,
  WebSocketEventSchema,
  WebSocketClientMessageSchema,
  safeParseWebSocketEvent,
  safeParseWebSocketEventJson,
  safeParseWebSocketClientMessageJson,
  type ParsedWebSocketEvent,
  type ParsedWebSocketEventType,
  type WebSocketClientMessage,
} from './wsSchemas';

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
  getRoomKind,
  getRoomTierFromRoomNumber,
  type RoomKind,
} from './inventory';

// Agreement content (built-in HTML used by kiosk + PDF generation)
export { AGREEMENT_LEGAL_BODY_HTML_BY_LANG, type AgreementLanguage } from './agreementContent';
