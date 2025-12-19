// Enums
export { RoomStatus, RoomType, BlockType, CheckinMode } from './enums';

// Transition validation
export { isAdjacentTransition, validateTransition, type TransitionResult } from './transitions';

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
} from './types';

// Zod schemas
export {
  RoomStatusSchema,
  RoomTypeSchema,
  RoomSchema,
  RoomStatusUpdateSchema,
  InventorySummarySchema,
  BatchStatusUpdateSchema,
  type RoomInput,
  type RoomStatusUpdateInput,
  type InventorySummaryInput,
  type BatchStatusUpdateInput,
} from './schemas';

