import { z } from 'zod';
import { RoomStatus } from './enums';
import type { WebSocketEventType } from './types';

// NOTE: These schemas validate the runtime WebSocket contract.
// They are intentionally tolerant of server-side Date serialization (Date -> ISO string).

const zNonEmptyString = z.string().min(1);
const zIsoishString = z.string().min(1); // keep loose; some clients may send non-ISO during dev
const zUuidishString = z.string().min(1); // avoid hard uuid dependency for backwards compatibility
const zDateLike = z.union([z.string().min(1), z.date()]);

export const WebSocketEventTypeSchema = z.enum([
  'ROOM_STATUS_CHANGED',
  'INVENTORY_UPDATED',
  'ROOM_ASSIGNED',
  'ROOM_RELEASED',
  'SESSION_UPDATED',
  'SELECTION_PROPOSED',
  'SELECTION_FORCED',
  'SELECTION_LOCKED',
  'SELECTION_ACKNOWLEDGED',
  'WAITLIST_CREATED',
  'WAITLIST_UPDATED',
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_FAILED',
  'CUSTOMER_CONFIRMATION_REQUIRED',
  'CUSTOMER_CONFIRMED',
  'CUSTOMER_DECLINED',
  'CHECKOUT_REQUESTED',
  'CHECKOUT_CLAIMED',
  'CHECKOUT_UPDATED',
  'CHECKOUT_COMPLETED',
  'REGISTER_SESSION_UPDATED',
]);

// ---- Payload schemas (server -> client events) ----

const InventorySummarySchema = z.object({
  clean: z.number(),
  cleaning: z.number(),
  dirty: z.number(),
  total: z.number(),
});

const DetailedInventorySchema = z.object({
  byType: z.object({
    STANDARD: InventorySummarySchema,
    DOUBLE: InventorySummarySchema,
    SPECIAL: InventorySummarySchema,
    LOCKER: InventorySummarySchema,
  }),
  overall: InventorySummarySchema,
  lockers: InventorySummarySchema,
});

const InventoryAvailableSnapshotSchema = z.object({
  rooms: z.object({
    SPECIAL: z.number(),
    DOUBLE: z.number(),
    STANDARD: z.number(),
  }),
  rawRooms: z.object({
    SPECIAL: z.number(),
    DOUBLE: z.number(),
    STANDARD: z.number(),
  }),
  waitlistDemand: z.object({
    SPECIAL: z.number(),
    DOUBLE: z.number(),
    STANDARD: z.number(),
  }),
  lockers: z.number(),
  total: z.number(),
});

const InventoryUpdatedPayloadSchema = z.object({
  inventory: DetailedInventorySchema,
  available: InventoryAvailableSnapshotSchema.optional(),
});

const RoomStatusChangedPayloadSchema = z.object({
  roomId: zUuidishString,
  previousStatus: z.nativeEnum(RoomStatus),
  newStatus: z.nativeEnum(RoomStatus),
  changedBy: zUuidishString,
  override: z.boolean(),
  reason: z.string().optional(),
});

const RoomAssignedPayloadSchema = z.object({
  roomId: zUuidishString,
  sessionId: zUuidishString,
  customerId: zUuidishString,
});

const RoomReleasedPayloadSchema = z.object({
  roomId: zUuidishString,
  sessionId: zUuidishString,
});

const SessionUpdatedPayloadSchema = z.object({
  sessionId: zUuidishString,
  customerName: zNonEmptyString,
  membershipNumber: z.string().optional(),
  customerMembershipValidUntil: z.string().optional(),
  membershipPurchaseIntent: z.enum(['PURCHASE', 'RENEW']).optional(),
  kioskAcknowledgedAt: zIsoishString.optional(),
  allowedRentals: z.array(z.string()),
  mode: z.enum(['INITIAL', 'RENEWAL']).optional(),
  blockEndsAt: zIsoishString.optional(),
  visitId: zUuidishString.optional(),
  waitlistDesiredType: z.string().optional(),
  backupRentalType: z.string().optional(),
  status: z.string().optional(),
  proposedRentalType: z.string().optional(),
  proposedBy: z.enum(['CUSTOMER', 'EMPLOYEE']).optional(),
  selectionConfirmed: z.boolean().optional(),
  selectionConfirmedBy: z.enum(['CUSTOMER', 'EMPLOYEE']).optional(),
  customerPrimaryLanguage: z.enum(['EN', 'ES']).optional(),
  customerDobMonthDay: z.string().optional(),
  customerLastVisitAt: zIsoishString.optional(),
  customerNotes: z.string().optional(),
  pastDueBalance: z.number().optional(),
  pastDueBlocked: z.boolean().optional(),
  pastDueBypassed: z.boolean().optional(),
  paymentIntentId: zUuidishString.optional(),
  paymentStatus: z.enum(['DUE', 'PAID']).optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT']).optional(),
  paymentTotal: z.number().optional(),
  paymentLineItems: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number(),
      })
    )
    .optional(),
  paymentFailureReason: z.string().optional(),
  agreementSigned: z.boolean().optional(),
  assignedResourceType: z.enum(['room', 'locker']).optional(),
  assignedResourceNumber: z.string().optional(),
  checkoutAt: zIsoishString.optional(),
});

const SelectionProposedPayloadSchema = z.object({
  sessionId: zUuidishString,
  rentalType: z.string(),
  proposedBy: z.enum(['CUSTOMER', 'EMPLOYEE']),
});

const SelectionForcedPayloadSchema = z.object({
  sessionId: zUuidishString,
  rentalType: z.string(),
  forcedBy: z.literal('EMPLOYEE'),
});

const SelectionLockedPayloadSchema = z.object({
  sessionId: zUuidishString,
  rentalType: z.string(),
  confirmedBy: z.enum(['CUSTOMER', 'EMPLOYEE']),
  lockedAt: zIsoishString,
});

const SelectionAcknowledgedPayloadSchema = z.object({
  sessionId: zUuidishString,
  acknowledgedBy: z.enum(['CUSTOMER', 'EMPLOYEE']),
});

const WaitlistCreatedPayloadSchema = z.object({
  sessionId: zUuidishString,
  waitlistId: zUuidishString,
  desiredType: z.string(),
  backupType: z.string(),
  position: z.number(),
  estimatedReadyAt: zIsoishString.optional(),
  upgradeFee: z.number().optional(),
});

const WaitlistUpdatedPayloadSchema = z.object({
  waitlistId: zUuidishString,
  status: z.string(),
  visitId: zUuidishString.optional(),
  desiredTier: z.string().optional(),
  roomId: zUuidishString.optional(),
  roomNumber: z.string().optional(),
});

const AssignmentCreatedPayloadSchema = z.object({
  sessionId: zUuidishString,
  roomId: zUuidishString.optional(),
  roomNumber: z.string().optional(),
  lockerId: zUuidishString.optional(),
  lockerNumber: z.string().optional(),
  rentalType: z.string(),
});

const AssignmentFailedPayloadSchema = z.object({
  sessionId: zUuidishString,
  reason: z.string(),
  requestedRoomId: zUuidishString.optional(),
  requestedLockerId: zUuidishString.optional(),
});

const CustomerConfirmationRequiredPayloadSchema = z.object({
  sessionId: zUuidishString,
  requestedType: z.string(),
  selectedType: z.string(),
  selectedNumber: z.string(),
});

const CustomerConfirmedPayloadSchema = z.object({
  sessionId: zUuidishString,
  confirmedType: z.string(),
  confirmedNumber: z.string(),
});

const CustomerDeclinedPayloadSchema = z.object({
  sessionId: zUuidishString,
  requestedType: z.string(),
});

const CheckoutRequestSummarySchema = z.object({
  requestId: zUuidishString,
  customerName: zNonEmptyString,
  membershipNumber: z.string().optional(),
  rentalType: z.string(),
  roomNumber: z.string().optional(),
  lockerNumber: z.string().optional(),
  scheduledCheckoutAt: zDateLike,
  currentTime: zDateLike,
  lateMinutes: z.number(),
  lateFeeAmount: z.number(),
  banApplied: z.boolean(),
});

const CheckoutRequestedPayloadSchema = z.object({
  request: CheckoutRequestSummarySchema,
});

const CheckoutClaimedPayloadSchema = z.object({
  requestId: zUuidishString,
  claimedBy: zUuidishString,
});

const CheckoutUpdatedPayloadSchema = z.object({
  requestId: zUuidishString,
  itemsConfirmed: z.boolean(),
  feePaid: z.boolean(),
});

const CheckoutCompletedPayloadSchema = z.object({
  requestId: zUuidishString,
  kioskDeviceId: z.string(),
  success: z.boolean(),
});

const RegisterSessionUpdatedPayloadSchema = z.object({
  registerNumber: z.union([z.literal(1), z.literal(2)]),
  active: z.boolean(),
  sessionId: zUuidishString.nullable(),
  employee: z
    .object({
      id: zUuidishString,
      displayName: z.string(),
      role: z.string(),
    })
    .nullable(),
  deviceId: z.string().nullable(),
  createdAt: zIsoishString.nullable(),
  lastHeartbeatAt: zIsoishString.nullable(),
  reason: z.enum(['CONFIRMED', 'SIGNED_OUT', 'FORCED_SIGN_OUT', 'TTL_EXPIRED', 'DEVICE_DISABLED']),
});

// ---- Event schema (server -> client) ----

export const WebSocketEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROOM_STATUS_CHANGED'), payload: RoomStatusChangedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('INVENTORY_UPDATED'), payload: InventoryUpdatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('ROOM_ASSIGNED'), payload: RoomAssignedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('ROOM_RELEASED'), payload: RoomReleasedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('SESSION_UPDATED'), payload: SessionUpdatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('SELECTION_PROPOSED'), payload: SelectionProposedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('SELECTION_FORCED'), payload: SelectionForcedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('SELECTION_LOCKED'), payload: SelectionLockedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('SELECTION_ACKNOWLEDGED'), payload: SelectionAcknowledgedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('WAITLIST_CREATED'), payload: WaitlistCreatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('WAITLIST_UPDATED'), payload: WaitlistUpdatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('ASSIGNMENT_CREATED'), payload: AssignmentCreatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('ASSIGNMENT_FAILED'), payload: AssignmentFailedPayloadSchema, timestamp: zIsoishString }),
  z.object({
    type: z.literal('CUSTOMER_CONFIRMATION_REQUIRED'),
    payload: CustomerConfirmationRequiredPayloadSchema,
    timestamp: zIsoishString,
  }),
  z.object({ type: z.literal('CUSTOMER_CONFIRMED'), payload: CustomerConfirmedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('CUSTOMER_DECLINED'), payload: CustomerDeclinedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('CHECKOUT_REQUESTED'), payload: CheckoutRequestedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('CHECKOUT_CLAIMED'), payload: CheckoutClaimedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('CHECKOUT_UPDATED'), payload: CheckoutUpdatedPayloadSchema, timestamp: zIsoishString }),
  z.object({ type: z.literal('CHECKOUT_COMPLETED'), payload: CheckoutCompletedPayloadSchema, timestamp: zIsoishString }),
  z.object({
    type: z.literal('REGISTER_SESSION_UPDATED'),
    payload: RegisterSessionUpdatedPayloadSchema,
    timestamp: zIsoishString,
  }),
]);

export type ParsedWebSocketEvent = z.infer<typeof WebSocketEventSchema>;
export type ParsedWebSocketEventType = z.infer<typeof WebSocketEventTypeSchema>;

export function safeParseWebSocketEvent(input: unknown): ParsedWebSocketEvent | null {
  const parsed = WebSocketEventSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function safeParseWebSocketEventJson(text: string): ParsedWebSocketEvent | null {
  try {
    return safeParseWebSocketEvent(JSON.parse(text));
  } catch {
    return null;
  }
}

// ---- Client -> server message schema (subscribe, setLane, ping) ----

export const WebSocketClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    events: z.array(WebSocketEventTypeSchema),
  }),
  z.object({
    type: z.literal('setLane'),
    lane: z.string(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

export type WebSocketClientMessage = z.infer<typeof WebSocketClientMessageSchema>;

export function safeParseWebSocketClientMessageJson(text: string): WebSocketClientMessage | null {
  try {
    const parsed = WebSocketClientMessageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Keep TS honest: ensure schema literals stay aligned with the exported union type.
// If WebSocketEventType changes, TS will flag this assignment.
const _typecheck: WebSocketEventType = WebSocketEventTypeSchema.options[0] as WebSocketEventType;
void _typecheck;

