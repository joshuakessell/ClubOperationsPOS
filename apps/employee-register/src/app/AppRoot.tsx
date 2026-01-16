import { useCallback, useEffect, useMemo, useReducer, useState, useRef } from 'react';
import {
  type ActiveVisit,
  type CheckoutRequestSummary,
  type CheckoutChecklist,
  getCustomerMembershipStatus,
} from '@club-ops/shared';
import { isRecord } from '@club-ops/ui';
import { parseStaffSession, type StaffSession } from '@club-ops/app-kit';

import { RegisterSignIn } from '../RegisterSignIn';
import type { IdScanPayload } from '@club-ops/shared';
type ScanResult =
  | { outcome: 'matched' }
  | { outcome: 'no_match'; message: string; canCreate?: boolean }
  | { outcome: 'error'; message: string };
import { debounce } from '../utils/debounce';
import { extractDobDigits, formatDobMmDdYyyy, parseDobDigitsToIso } from '../utils/dob';
import { OfferUpgradeModal } from '../components/OfferUpgradeModal';
import { CheckoutRequestsBanner } from '../features/register/CheckoutRequestsBanner';
import { CheckoutVerificationModal } from '../features/register/CheckoutVerificationModal';
import { AgreementArtifactsModal } from '../features/register/AgreementArtifactsModal';
import { RegisterHeader } from '../features/register/RegisterHeader';
import { RegisterTopActionsBar } from '../features/register/RegisterTopActionsBar';
import { useEmployeeRegisterTabletUiTweaks } from '../hooks/useEmployeeRegisterTabletUiTweaks';
import { RequiredTenderOutcomeModal } from '../features/register/modals/RequiredTenderOutcomeModal';
import { WaitlistNoticeModal } from '../features/register/modals/WaitlistNoticeModal';
import {
  AlreadyCheckedInModal,
  type ActiveCheckinDetails,
} from '../features/register/modals/AlreadyCheckedInModal';
import { CustomerConfirmationPendingModal } from '../features/register/modals/CustomerConfirmationPendingModal';
import { PastDuePaymentModal } from '../features/register/modals/PastDuePaymentModal';
import { ManagerBypassModal } from '../features/register/modals/ManagerBypassModal';
import { UpgradePaymentModal } from '../features/register/modals/UpgradePaymentModal';
import { AddNoteModal } from '../features/register/modals/AddNoteModal';
import { AlertModal } from '../features/register/modals/AlertModal';
import { MembershipIdPromptModal } from '../features/register/modals/MembershipIdPromptModal';
import { ModalFrame } from '../features/register/modals/ModalFrame';
import { TransactionCompleteModal } from '../features/register/modals/TransactionCompleteModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  MultipleMatchesModal,
  type MultipleMatchCandidate,
} from '../features/register/modals/MultipleMatchesModal';
import { PaymentDeclineToast } from '../features/register/toasts/PaymentDeclineToast';
import { ScanToastOverlay } from '../components/ScanToastOverlay';
import { RegisterSideDrawers } from '../components/drawers/RegisterSideDrawers';
import { UpgradesDrawerContent } from '../features/upgrades/UpgradesDrawerContent';
import { InventoryDrawer, type InventoryDrawerSection } from '../features/inventory/InventoryDrawer';
import { useRegisterTopActionsOverlays } from '../features/register/useRegisterTopActionsOverlays';
import { usePassiveScannerInput } from '../usePassiveScannerInput';
import { RegisterMainView } from '../features/register/views/RegisterMainView';
import {
  initialRegisterSessionState,
  type RegisterSessionState,
  registerSessionReducer,
} from './registerSessionReducer';
import { useEmployeeRegisterWs } from '../ws/useEmployeeRegisterWs';
import {
  authLogout,
  addNote,
  assignResource,
  checkoutClaim,
  checkoutComplete,
  checkoutConfirmItems,
  checkoutMarkFeePaid,
  checkinScan,
  completeMembershipPurchase,
  confirmSelection,
  createPaymentIntent,
  customersCreateFromScan,
  customersCreateManual,
  customersMatchIdentity,
  demoTakePayment,
  documentDownloadPdf,
  documentsBySession,
  employeesAvailable,
  getHealth,
  inventoryAvailable as apiInventoryAvailable,
  isApiError,
  laneReset,
  manualSignatureOverride,
  pastDueBypass,
  pastDueDemoPayment,
  paymentsMarkPaid,
  proposeSelection,
  registerSignout,
  scanId,
  searchCustomers,
  startLaneSession as apiStartLaneSession,
  upgradesComplete,
  upgradesFulfill,
  waitlistList,
  type SessionDocument as ApiSessionDocument,
} from '../api/employeeRegisterApi';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

type SessionDocument = ApiSessionDocument;

/**
 * Generate a UUID. Falls back to a simple random string if crypto.randomUUID() is not available.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to fallback
    }
  }
  // Fallback: generate a UUID-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AppRoot() {
  // Tablet usability tweaks (Employee Register ONLY): measure baseline typography before applying CSS bumps.
  useEmployeeRegisterTabletUiTweaks();
  const tryOpenAlreadyCheckedInModal = (payload: unknown, customerLabel?: string | null): boolean => {
    if (!isRecord(payload)) return false;
    if (payload['code'] !== 'ALREADY_CHECKED_IN') return false;
    const ac = payload['activeCheckin'];
    if (!isRecord(ac)) return false;

    const visitId = ac['visitId'];
    if (typeof visitId !== 'string') return false;

    const rentalTypeRaw = ac['rentalType'];
    const rentalType = typeof rentalTypeRaw === 'string' ? rentalTypeRaw : null;

    const assignedResourceTypeRaw = ac['assignedResourceType'];
    const assignedResourceType =
      assignedResourceTypeRaw === 'room' || assignedResourceTypeRaw === 'locker'
        ? assignedResourceTypeRaw
        : null;

    const assignedResourceNumberRaw = ac['assignedResourceNumber'];
    const assignedResourceNumber =
      typeof assignedResourceNumberRaw === 'string' ? assignedResourceNumberRaw : null;

    const checkinAtRaw = ac['checkinAt'];
    const checkinAt = typeof checkinAtRaw === 'string' ? checkinAtRaw : null;

    const checkoutAtRaw = ac['checkoutAt'];
    const checkoutAt = typeof checkoutAtRaw === 'string' ? checkoutAtRaw : null;

    const overdueRaw = ac['overdue'];
    const overdue = typeof overdueRaw === 'boolean' ? overdueRaw : null;

    const wlRaw = ac['waitlist'];
    let waitlist: ActiveCheckinDetails['waitlist'] = null;
    if (isRecord(wlRaw)) {
      const id = wlRaw['id'];
      const desiredTier = wlRaw['desiredTier'];
      const backupTier = wlRaw['backupTier'];
      const status = wlRaw['status'];
      if (
        typeof id === 'string' &&
        typeof desiredTier === 'string' &&
        typeof backupTier === 'string' &&
        typeof status === 'string'
      ) {
        waitlist = { id, desiredTier, backupTier, status };
      }
    }

    setAlreadyCheckedIn({
      customerLabel: customerLabel || null,
      activeCheckin: {
        visitId,
        rentalType,
        assignedResourceType,
        assignedResourceNumber,
        checkinAt,
        checkoutAt,
        overdue,
        waitlist,
      },
    });
    return true;
  };

  const [session, setSession] = useState<StaffSession | null>(() => {
    // Load session from localStorage on mount
    const stored = localStorage.getItem('staff_session');
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored) as unknown;
        return parseStaffSession(parsed);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [passiveScanProcessing, setPassiveScanProcessing] = useState(false);
  const passiveScanProcessingRef = useRef(false);
  const [scanOverlayMounted, setScanOverlayMounted] = useState(false);
  const [scanOverlayActive, setScanOverlayActive] = useState(false);
  const scanOverlayHideTimerRef = useRef<number | null>(null);
  const scanOverlayShownAtRef = useRef<number | null>(null);
  const SCAN_OVERLAY_MIN_VISIBLE_MS = 300;
  const [manualEntry, setManualEntry] = useState(false);
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualDobDigits, setManualDobDigits] = useState('');
  const [manualEntrySubmitting, setManualEntrySubmitting] = useState(false);
  const [manualExistingPrompt, setManualExistingPrompt] = useState<null | {
    firstName: string;
    lastName: string;
    dobIso: string;
    matchCount: number;
    bestMatch: { id: string; name: string; membershipNumber?: string | null; dob?: string | null };
  }>(null);
  const [manualExistingPromptError, setManualExistingPromptError] = useState<string | null>(null);
  const [manualExistingPromptSubmitting, setManualExistingPromptSubmitting] = useState(false);
  const [isUpgradesDrawerOpen, setIsUpgradesDrawerOpen] = useState(false);
  const [isInventoryDrawerOpen, setIsInventoryDrawerOpen] = useState(false);
  const [inventoryForcedSection, setInventoryForcedSection] = useState<InventoryDrawerSection>(null);
  const [registerState, dispatchRegister] = useReducer(
    registerSessionReducer,
    initialRegisterSessionState
  );
  const patchRegister = useCallback(
    (patch: Partial<RegisterSessionState>) => {
      dispatchRegister({ type: 'PATCH', patch });
    },
    [dispatchRegister]
  );

  const [alertModal, setAlertModal] = useState<null | { title?: string; message: string }>(null);
  const showAlert = useCallback((message: string, title?: string) => {
    setAlertModal({ message, title });
  }, []);

  const customerName = registerState.customerName;
  const membershipNumber = registerState.membershipNumber;
  const [pendingCreateFromScan, setPendingCreateFromScan] = useState<{
    idScanValue: string;
    idScanHash: string | null;
    extracted: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      dob?: string;
      idNumber?: string;
      issuer?: string;
      jurisdiction?: string;
      addressLine1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  } | null>(null);
  const [showCreateFromScanPrompt, setShowCreateFromScanPrompt] = useState(false);
  const [createFromScanError, setCreateFromScanError] = useState<string | null>(null);
  const [createFromScanSubmitting, setCreateFromScanSubmitting] = useState(false);

  const [pendingScanResolution, setPendingScanResolution] = useState<null | {
    rawScanText: string;
    extracted?: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      dob?: string;
      idNumber?: string;
      issuer?: string;
      jurisdiction?: string;
    };
    candidates: MultipleMatchCandidate[];
  }>(null);
  const [scanResolutionError, setScanResolutionError] = useState<string | null>(null);
  const [scanResolutionSubmitting, setScanResolutionSubmitting] = useState(false);
  const [scanToastMessage, setScanToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentSessionId = registerState.sessionId;
  const agreementSigned = registerState.agreementSigned;
  // Check-in mode is now auto-detected server-side based on active visits/assignments.
  const [selectedRentalType, setSelectedRentalType] = useState<string | null>(null);
  const [checkoutRequests, setCheckoutRequests] = useState<Map<string, CheckoutRequestSummary>>(
    new Map()
  );
  const [selectedCheckoutRequest, setSelectedCheckoutRequest] = useState<string | null>(null);
  const [, setCheckoutChecklist] = useState<CheckoutChecklist>({});
  const [checkoutItemsConfirmed, setCheckoutItemsConfirmed] = useState(false);
  const [checkoutFeePaid, setCheckoutFeePaid] = useState(false);
  const customerSelectedType = registerState.customerSelectedType;
  const waitlistDesiredTier = registerState.waitlistDesiredTier;
  const waitlistBackupType = registerState.waitlistBackupType;
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<{
    type: 'room' | 'locker';
    id: string;
    number: string;
    tier: string;
  } | null>(null);
  const proposedRentalType = registerState.proposedRentalType;
  const proposedBy = registerState.proposedBy;
  const selectionConfirmed = registerState.selectionConfirmed;
  const selectionConfirmedBy = registerState.selectionConfirmedBy;
  const selectionAcknowledged = registerState.selectionAcknowledged;
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<null | {
    customerLabel: string | null;
    activeCheckin: ActiveCheckinDetails;
  }>(null);
  const [showCustomerConfirmationPending, setShowCustomerConfirmationPending] = useState(false);
  const [customerConfirmationType, setCustomerConfirmationType] = useState<{
    requested: string;
    selected: string;
    number: string;
  } | null>(null);
  const paymentIntentId = registerState.paymentIntentId;
  const paymentQuote = registerState.paymentQuote;
  const paymentStatus = registerState.paymentStatus;
  const membershipPurchaseIntent = registerState.membershipPurchaseIntent;
  const customerMembershipValidUntil = registerState.customerMembershipValidUntil;

  // Agreement/PDF verification (staff-only)
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsForSession, setDocumentsForSession] = useState<SessionDocument[] | null>(null);

  // Keep WebSocket handlers stable while still reading the latest values.
  const selectedCheckoutRequestRef = useRef<string | null>(null);
  useEffect(() => {
    selectedCheckoutRequestRef.current = selectedCheckoutRequest;
  }, [selectedCheckoutRequest]);

  const currentSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const customerSelectedTypeRef = useRef<string | null>(null);
  useEffect(() => {
    customerSelectedTypeRef.current = customerSelectedType;
  }, [customerSelectedType]);

  // UI-only effects driven by server-authoritative session updates.
  useEffect(() => {
    if (registerState.pastDueModalEpoch > 0) {
      setShowPastDueModal(true);
    }
  }, [registerState.pastDueModalEpoch]);

  useEffect(() => {
    if (registerState.clearEpoch > 0) {
      setSelectedInventoryItem(null);
      setShowMembershipIdPrompt(false);
      setMembershipIdInput('');
      setMembershipIdError(null);
      setMembershipIdPromptedForSessionId(null);
      setShowWaitlistModal(false);
    }
  }, [registerState.clearEpoch]);

  useEffect(() => {
    if (registerState.paymentFailureReason) {
      setPaymentDeclineError(registerState.paymentFailureReason);
    }
  }, [registerState.paymentFailureReason]);

  const [showMembershipIdPrompt, setShowMembershipIdPrompt] = useState(false);
  const [membershipIdInput, setMembershipIdInput] = useState('');
  const [membershipIdMode, setMembershipIdMode] = useState<'KEEP_EXISTING' | 'ENTER_NEW'>('ENTER_NEW');
  const [membershipIdSubmitting, setMembershipIdSubmitting] = useState(false);
  const [membershipIdError, setMembershipIdError] = useState<string | null>(null);
  const [membershipIdPromptedForSessionId, setMembershipIdPromptedForSessionId] = useState<string | null>(
    null
  );
  const pastDueBlocked = registerState.pastDueBlocked;
  const pastDueBalance = registerState.pastDueBalance;
  const [waitlistEntries, setWaitlistEntries] = useState<
    Array<{
      id: string;
      visitId: string;
      checkinBlockId: string;
      desiredTier: string;
      backupTier: string;
      status: string;
      createdAt: string;
      checkinAt?: string;
      checkoutAt?: string;
      offeredAt?: string;
      roomId?: string | null;
      offeredRoomNumber?: string | null;
      displayIdentifier: string;
      currentRentalType: string;
      customerName?: string;
    }>
  >([]);
  const [inventoryAvailable, setInventoryAvailable] = useState<null | {
    rooms: Record<string, number>;
    rawRooms: Record<string, number>;
    waitlistDemand: Record<string, number>;
    lockers: number;
  }>(null);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<string | null>(null);
  const [upgradePaymentIntentId, setUpgradePaymentIntentId] = useState<string | null>(null);
  const [upgradeFee, setUpgradeFee] = useState<number | null>(null);
  const [upgradePaymentStatus, setUpgradePaymentStatus] = useState<'DUE' | 'PAID' | null>(null);
  const [upgradeOriginalCharges, setUpgradeOriginalCharges] = useState<
    Array<{ description: string; amount: number }>
  >([]);
  const [upgradeOriginalTotal, setUpgradeOriginalTotal] = useState<number | null>(null);
  const [showUpgradePaymentModal, setShowUpgradePaymentModal] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<{
    waitlistId: string;
    customerLabel: string;
    offeredRoomNumber?: string | null;
    newRoomNumber?: string | null;
  } | null>(null);
  const [showUpgradePulse, setShowUpgradePulse] = useState(false);
  const [offerUpgradeModal, setOfferUpgradeModal] = useState<{
    waitlistId: string;
    desiredTier: 'STANDARD' | 'DOUBLE' | 'SPECIAL';
    customerLabel?: string;
  } | null>(null);
  const [inventoryHasLate, setInventoryHasLate] = useState(false);

  // Customer info (server-authoritative view-model)
  const customerPrimaryLanguage = registerState.customerPrimaryLanguage ?? undefined;
  const customerDobMonthDay = registerState.customerDobMonthDay ?? undefined;
  const customerLastVisitAt = registerState.customerLastVisitAt ?? undefined;
  const customerNotes = registerState.customerNotes ?? undefined;
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Past due state
  const [showPastDueModal, setShowPastDueModal] = useState(false);
  const [showManagerBypassModal, setShowManagerBypassModal] = useState(false);
  const [managerId, setManagerId] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [managerList, setManagerList] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentDeclineError, setPaymentDeclineError] = useState<string | null>(null);
  const paymentIntentCreateInFlightRef = useRef(false);
  const fetchWaitlistRef = useRef<(() => Promise<void>) | null>(null);
  const fetchInventoryAvailableRef = useRef<(() => Promise<void>) | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<
    Array<{
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      dobMonthDay?: string;
      membershipNumber?: string;
      disambiguator: string;
    }>
  >([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState<string | null>(null);

  // Assignment completion (server-authoritative view-model)
  const assignedResourceType = registerState.assignedResourceType;
  const assignedResourceNumber = registerState.assignedResourceNumber;
  const checkoutAt = registerState.checkoutAt;

  const deviceId = useState(() => {
    try {
      // Get device ID from environment variable or generate a stable per-device base ID.
      // In development, you may have multiple tabs open; we add a per-tab instance suffix
      // (stored in sessionStorage) so two tabs on the same machine can sign into
      // different registers without colliding on deviceId.
      const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
      const envDeviceId = env?.['VITE_DEVICE_ID'];
      if (typeof envDeviceId === 'string' && envDeviceId.trim()) {
        return envDeviceId;
      }

      let baseId: string | null = null;
      try {
        baseId = localStorage.getItem('device_id');
      } catch {
        // localStorage might not be available (e.g., private browsing)
      }

      if (!baseId) {
        baseId = `device-${generateUUID()}`;
        try {
          localStorage.setItem('device_id', baseId);
        } catch {
          // If we can't store it, that's okay - we'll regenerate each time
        }
      }

      let instanceId: string | null = null;
      try {
        instanceId = sessionStorage.getItem('device_instance_id');
      } catch {
        // sessionStorage might not be available
      }

      if (!instanceId) {
        instanceId = generateUUID();
        try {
          sessionStorage.setItem('device_instance_id', instanceId);
        } catch {
          // If we can't store it, that's okay
        }
      }

      return `${baseId}:${instanceId}`;
    } catch (error) {
      // Fallback: generate a temporary device ID if anything fails
      console.error('Failed to generate device ID:', error);
      return `device-temp-${generateUUID()}`;
    }
  })[0];

  const [registerSession, setRegisterSession] = useState<{
    employeeId: string;
    employeeName: string;
    registerNumber: number;
    deviceId: string;
  } | null>(null);

  // Derive lane from register number
  const lane = registerSession ? `lane-${registerSession.registerNumber}` : 'lane-1';

  const handleLogout = async () => {
    try {
      if (session?.sessionToken) {
        // IMPORTANT: release the register session (server-side) before logging out staff.
        // This makes the separate "menu sign out" redundant and keeps register availability correct.
        try {
          await registerSignout({ sessionToken: session.sessionToken, deviceId });
        } catch (err) {
          console.warn('Register signout failed (continuing):', err);
        }

        await authLogout({ sessionToken: session.sessionToken });
      }
    } catch (err) {
      console.warn('Logout failed (continuing):', err);
    } finally {
      localStorage.removeItem('staff_session');
      setSession(null);
      // Ensure RegisterSignIn re-runs status checks and clears any lingering client state immediately.
      window.location.reload();
    }
  };

  const handleCloseOut = async () => {
    const confirmed = window.confirm('Close Out: this will sign you out of the register. Continue?');
    if (!confirmed) return;
    await handleLogout();
  };
  const runCustomerSearch = useCallback(
    debounce(async (query: string) => {
      if (!session?.sessionToken || query.trim().length < 3) {
        setCustomerSuggestions([]);
        setCustomerSearchLoading(false);
        return;
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setCustomerSearchLoading(true);
      try {
        const data = await searchCustomers({
          sessionToken: session.sessionToken,
          query,
          limit: 10,
          signal: controller.signal,
        });
        setCustomerSuggestions(data.suggestions || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Customer search failed:', error);
          setCustomerSuggestions([]);
        }
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 200),
    [session?.sessionToken]
  );

  useEffect(() => {
    if (customerSearch.trim().length >= 3) {
      setSelectedCustomerId(null);
      setSelectedCustomerLabel(null);
      runCustomerSearch(customerSearch);
    } else {
      setCustomerSuggestions([]);
      setSelectedCustomerId(null);
      setSelectedCustomerLabel(null);
    }
  }, [customerSearch, runCustomerSearch]);

  const handleConfirmCustomerSelection = async () => {
    if (!session?.sessionToken || !selectedCustomerId) return;
    setIsSubmitting(true);
    try {
      setAlreadyCheckedIn(null);
      // Customer search selection should attach to the *check-in lane session* system
      // (lane_sessions), not legacy sessions, so downstream kiosk endpoints (set-language, etc.)
      // can resolve the active session.
      let data: {
        sessionId?: string;
        customerName?: string;
        membershipNumber?: string;
        mode?: 'INITIAL' | 'RENEWAL';
        blockEndsAt?: string;
        activeAssignedResourceType?: 'room' | 'locker';
        activeAssignedResourceNumber?: string;
      };
      try {
        data = await apiStartLaneSession({
          sessionToken: session.sessionToken,
          lane,
          body: { customerId: selectedCustomerId },
        });
      } catch (err) {
        if (isApiError(err) && err.status === 409) {
          if (tryOpenAlreadyCheckedInModal(err.body, selectedCustomerLabel || selectedCustomerId)) {
            return;
          }
        }
        throw err;
      }
      if (data.customerName) patchRegister({ customerName: data.customerName });
      if (data.membershipNumber) patchRegister({ membershipNumber: data.membershipNumber });
      if (data.sessionId) patchRegister({ sessionId: data.sessionId });
      if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
        if (data.activeAssignedResourceType)
          patchRegister({ assignedResourceType: data.activeAssignedResourceType });
        if (data.activeAssignedResourceNumber)
          patchRegister({ assignedResourceNumber: data.activeAssignedResourceNumber });
        patchRegister({ checkoutAt: data.blockEndsAt });
      }

      // Clear search UI
      setCustomerSearch('');
      setCustomerSuggestions([]);
    } catch (error) {
      console.error('Failed to confirm customer:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to confirm customer', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load staff session from localStorage (created after register sign-in)
  useEffect(() => {
    const stored = localStorage.getItem('staff_session');
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored) as unknown;
        setSession(parseStaffSession(parsed));
      } catch {
        setSession(null);
      }
    }
  }, []);

  const handleRegisterSignIn = useCallback(
    (session: {
      employeeId: string;
      employeeName: string;
      registerNumber: number;
      deviceId: string;
    }) => {
      setRegisterSession(session);
      // Refresh staff session from localStorage after register sign-in
      const stored = localStorage.getItem('staff_session');
      if (stored) {
        try {
          const parsed: unknown = JSON.parse(stored) as unknown;
          const staffSession = parseStaffSession(parsed);
          if (staffSession) {
            setSession(staffSession);
          }
        } catch {
          setSession(null);
        }
      }
    },
    [setRegisterSession, setSession]
  );

  const handleIdScan = async (
    payload: IdScanPayload,
    opts?: { suppressAlerts?: boolean }
  ): Promise<ScanResult> => {
    if (!session?.sessionToken) {
      const msg = 'Not authenticated';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    }

    setIsSubmitting(true);
    try {
      setAlreadyCheckedIn(null);
      let data: {
        customerName?: string;
        membershipNumber?: string;
        sessionId?: string;
        mode?: 'INITIAL' | 'RENEWAL';
        blockEndsAt?: string;
        activeAssignedResourceType?: 'room' | 'locker';
        activeAssignedResourceNumber?: string;
      };
      try {
        data = await scanId({ sessionToken: session.sessionToken, lane, payload });
      } catch (err) {
        if (isApiError(err) && err.status === 409) {
          if (tryOpenAlreadyCheckedInModal(err.body, customerName || null)) {
            return { outcome: 'matched' };
          }
        }
        const msg = err instanceof Error ? err.message : 'Failed to scan ID';
        if (!opts?.suppressAlerts) showAlert(msg, 'Error');
        // Treat 400 as "no match / invalid ID data", keep scan mode open.
        if (isApiError(err) && err.status === 400) return { outcome: 'no_match', message: msg };
        return { outcome: 'error', message: msg };
      }
      console.log('ID scanned, session updated:', data);

      // Update local state
      if (data.customerName) patchRegister({ customerName: data.customerName });
      if (data.membershipNumber) patchRegister({ membershipNumber: data.membershipNumber });
      if (data.sessionId) patchRegister({ sessionId: data.sessionId });
      if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
        if (data.activeAssignedResourceType)
          patchRegister({ assignedResourceType: data.activeAssignedResourceType });
        if (data.activeAssignedResourceNumber)
          patchRegister({ assignedResourceNumber: data.activeAssignedResourceNumber });
        patchRegister({ checkoutAt: data.blockEndsAt });
      }

      return { outcome: 'matched' };
    } catch (error) {
      console.error('Failed to scan ID:', error);
      const msg = error instanceof Error ? error.message : 'Failed to scan ID';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const startLaneSession = async (
    idScanValue: string,
    membershipScanValue?: string | null,
    opts?: { suppressAlerts?: boolean }
  ): Promise<ScanResult> => {
    if (!session?.sessionToken) {
      const msg = 'Not authenticated';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    }

    setIsSubmitting(true);
    try {
      setAlreadyCheckedIn(null);
      let data: {
        customerName?: string;
        membershipNumber?: string;
        sessionId?: string;
        mode?: 'INITIAL' | 'RENEWAL';
        blockEndsAt?: string;
        activeAssignedResourceType?: 'room' | 'locker';
        activeAssignedResourceNumber?: string;
      };
      try {
        data = await apiStartLaneSession({
          sessionToken: session.sessionToken,
          lane,
          body: { idScanValue, membershipScanValue: membershipScanValue || undefined },
        });
      } catch (err) {
        if (isApiError(err) && err.status === 409 && tryOpenAlreadyCheckedInModal(err.body, idScanValue)) {
          return { outcome: 'matched' };
        }
        const msg = err instanceof Error ? err.message : 'Failed to start session';
        if (!opts?.suppressAlerts) showAlert(msg, 'Error');
        return { outcome: 'error', message: msg };
      }
      console.log('Session started:', data);

      // Update local state
      if (data.customerName) patchRegister({ customerName: data.customerName });
      if (data.membershipNumber) patchRegister({ membershipNumber: data.membershipNumber });
      if (data.sessionId) patchRegister({ sessionId: data.sessionId });
      if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
        if (data.activeAssignedResourceType)
          patchRegister({ assignedResourceType: data.activeAssignedResourceType });
        if (data.activeAssignedResourceNumber)
          patchRegister({ assignedResourceNumber: data.activeAssignedResourceNumber });
        patchRegister({ checkoutAt: data.blockEndsAt });
      }

      // Clear manual entry mode if active
      if (manualEntry) {
        setManualEntry(false);
      }
      return { outcome: 'matched' };
    } catch (error) {
      console.error('Failed to start session:', error);
      const msg = error instanceof Error ? error.message : 'Failed to start session';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const startLaneSessionByCustomerId = async (
    customerId: string,
    opts?: { suppressAlerts?: boolean }
  ): Promise<ScanResult> => {
    if (!session?.sessionToken) {
      const msg = 'Not authenticated';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    }

    setIsSubmitting(true);
    try {
      setAlreadyCheckedIn(null);
      let data: {
        sessionId?: string;
        customerName?: string;
        membershipNumber?: string;
        mode?: 'INITIAL' | 'RENEWAL';
        blockEndsAt?: string;
        activeAssignedResourceType?: 'room' | 'locker';
        activeAssignedResourceNumber?: string;
      };
      try {
        data = await apiStartLaneSession({
          sessionToken: session.sessionToken,
          lane,
          body: { customerId },
        });
      } catch (err) {
        if (isApiError(err) && err.status === 409 && tryOpenAlreadyCheckedInModal(err.body, null)) {
          return { outcome: 'matched' };
        }
        const msg = err instanceof Error ? err.message : 'Failed to start session';
        if (!opts?.suppressAlerts) showAlert(msg, 'Error');
        return { outcome: 'error', message: msg };
      }

      if (data.customerName) patchRegister({ customerName: data.customerName });
      if (data.membershipNumber) patchRegister({ membershipNumber: data.membershipNumber });
      if (data.sessionId) patchRegister({ sessionId: data.sessionId });
      if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
        if (data.activeAssignedResourceType)
          patchRegister({ assignedResourceType: data.activeAssignedResourceType });
        if (data.activeAssignedResourceNumber)
          patchRegister({ assignedResourceNumber: data.activeAssignedResourceNumber });
        patchRegister({ checkoutAt: data.blockEndsAt });
      }

      if (manualEntry) setManualEntry(false);
      return { outcome: 'matched' };
    } catch (error) {
      console.error('Failed to start session by customerId:', error);
      const msg = error instanceof Error ? error.message : 'Failed to start session';
      if (!opts?.suppressAlerts) showAlert(msg, 'Error');
      return { outcome: 'error', message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = manualFirstName.trim();
    const lastName = manualLastName.trim();
    const dobIso = parseDobDigitsToIso(manualDobDigits);
    if (!firstName || !lastName || !dobIso) {
      showAlert('Please enter First Name, Last Name, and a valid Date of Birth (MM/DD/YYYY).', 'Validation');
      return;
    }
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    setManualEntrySubmitting(true);
    setManualExistingPromptError(null);
    try {
      // First: check for existing customer match (name + dob).
      let data: {
        matchCount?: number;
        bestMatch?: { id?: string; name?: string; membershipNumber?: string | null; dob?: string | null } | null;
      };
      try {
        data = await customersMatchIdentity({
          sessionToken: session.sessionToken,
          firstName,
          lastName,
          dob: dobIso,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to check for existing customer';
        setManualExistingPromptError(msg);
        return;
      }
      const best = data.bestMatch;
      const matchCount = typeof data.matchCount === 'number' ? data.matchCount : 0;
      if (best && typeof best.id === 'string' && typeof best.name === 'string') {
        // Show confirmation prompt instead of creating a duplicate immediately.
        setManualExistingPrompt({
          firstName,
          lastName,
          dobIso,
          matchCount,
          bestMatch: { id: best.id, name: best.name, membershipNumber: best.membershipNumber, dob: best.dob },
        });
        return;
      }

      // No match: create new customer then load it.
      let created: { customer?: { id?: string } };
      try {
        created = await customersCreateManual({
          sessionToken: session.sessionToken,
          firstName,
          lastName,
          dob: dobIso,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create customer';
        setManualExistingPromptError(msg);
        return;
      }
      const newId = created.customer?.id;
      if (!newId) {
        setManualExistingPromptError('Create returned no customer id');
        return;
      }

      const result = await startLaneSessionByCustomerId(newId, { suppressAlerts: true });
      if (result.outcome === 'matched') {
        setManualEntry(false);
        setManualFirstName('');
        setManualLastName('');
        setManualDobDigits('');
      }
    } finally {
      setManualEntrySubmitting(false);
    }
  };

  const onBarcodeCaptured = async (rawScanText: string): Promise<ScanResult> => {
    if (!session?.sessionToken) {
      return { outcome: 'error', message: 'Not authenticated' };
    }

    try {
      const data = await checkinScan({
        sessionToken: session.sessionToken,
        laneId: lane,
        rawScanText,
      });

      if (data.result === 'ERROR') {
        return { outcome: 'error', message: data.error?.message || 'Scan failed' };
      }

      if (data.result === 'MATCHED' && data.customer?.id) {
        setPendingCreateFromScan(null);
        setShowCreateFromScanPrompt(false);
        setCreateFromScanError(null);
        setPendingScanResolution(null);
        setScanResolutionError(null);
        // Open customer record (start lane session) using the resolved customerId.
        return await startLaneSessionByCustomerId(data.customer.id, { suppressAlerts: true });
      }

      if (data.result === 'MULTIPLE_MATCHES' && data.scanType === 'STATE_ID') {
        const extracted = data.extracted || {};
        setPendingCreateFromScan(null);
        setShowCreateFromScanPrompt(false);
        setCreateFromScanError(null);
        setScanResolutionError(null);
        setPendingScanResolution({
          rawScanText,
          extracted: {
            firstName: extracted.firstName,
            lastName: extracted.lastName,
            fullName: extracted.fullName,
            dob: extracted.dob,
            idNumber: extracted.idNumber,
            issuer: extracted.issuer,
            jurisdiction: extracted.jurisdiction,
          },
          candidates: (data.candidates || []).slice(0, 10),
        });
        // Let the employee select the correct customer.
        return { outcome: 'matched' };
      }

      // NO_MATCH
      if (data.scanType === 'STATE_ID') {
        const extracted = data.extracted || {};
        setPendingCreateFromScan({
          idScanValue: data.normalizedRawScanText || rawScanText,
          idScanHash: data.idScanHash || null,
          extracted: {
            firstName: extracted.firstName,
            lastName: extracted.lastName,
            fullName: extracted.fullName,
            dob: extracted.dob,
            idNumber: extracted.idNumber,
            issuer: extracted.issuer,
            jurisdiction: extracted.jurisdiction,
          },
        });
        return {
          outcome: 'no_match',
          message: 'No match found. Create new account?',
          canCreate: true,
        };
      }

      // Membership/general barcode no-match: do not create implicitly.
      setPendingCreateFromScan(null);
      const label = data.membershipCandidate ? ` (${data.membershipCandidate})` : '';
      return {
        outcome: 'no_match',
        message: `No match found${label}. Scan ID or use Manual Entry.`,
        canCreate: false,
      };
    } catch (error) {
      console.error('Scan failed:', error);
      return { outcome: 'error', message: error instanceof Error ? error.message : 'Scan failed' };
    }
  };

  const blockingModalOpen =
    !!pendingScanResolution ||
    showCreateFromScanPrompt ||
    !!alreadyCheckedIn ||
    showPastDueModal ||
    showManagerBypassModal ||
    showMembershipIdPrompt ||
    showUpgradePaymentModal ||
    showAddNoteModal ||
    documentsModalOpen ||
    !!offerUpgradeModal ||
    (showWaitlistModal && !!waitlistDesiredTier && !!waitlistBackupType) ||
    (showCustomerConfirmationPending && !!customerConfirmationType) ||
    !!selectedCheckoutRequest;

  const passiveScanEnabled =
    !!session?.sessionToken && !passiveScanProcessing && !isSubmitting && !manualEntry && !blockingModalOpen;

  const showScanOverlay = useCallback(() => {
    if (scanOverlayHideTimerRef.current) {
      window.clearTimeout(scanOverlayHideTimerRef.current);
      scanOverlayHideTimerRef.current = null;
    }
    scanOverlayShownAtRef.current = performance.now();
    setScanOverlayMounted(true);
    // Ensure CSS transition runs by toggling active on next frame.
    window.requestAnimationFrame(() => setScanOverlayActive(true));
  }, []);

  const hideScanOverlay = useCallback(() => {
    const shownAt = scanOverlayShownAtRef.current;
    const elapsed = shownAt ? performance.now() - shownAt : Number.POSITIVE_INFINITY;
    const remaining = Math.max(0, SCAN_OVERLAY_MIN_VISIBLE_MS - elapsed);

    if (scanOverlayHideTimerRef.current) {
      window.clearTimeout(scanOverlayHideTimerRef.current);
      scanOverlayHideTimerRef.current = null;
    }

    scanOverlayHideTimerRef.current = window.setTimeout(() => {
      setScanOverlayActive(false);
      // After fade-out, fully unmount.
      window.setTimeout(() => {
        setScanOverlayMounted(false);
        scanOverlayHideTimerRef.current = null;
        scanOverlayShownAtRef.current = null;
      }, 220);
    }, remaining);
  }, []);

  const handlePassiveCapture = useCallback(
    (rawScanText: string) => {
      void (async () => {
        setScanToastMessage(null);
        passiveScanProcessingRef.current = true;
        setPassiveScanProcessing(true);
        const result = await onBarcodeCaptured(rawScanText);
        passiveScanProcessingRef.current = false;
        setPassiveScanProcessing(false);
        hideScanOverlay();
        if (result.outcome === 'no_match') {
          if (result.canCreate) {
            setCreateFromScanError(null);
            setShowCreateFromScanPrompt(true);
          } else {
            setScanToastMessage(result.message);
          }
          return;
        }
        if (result.outcome === 'error') {
          setScanToastMessage(result.message);
        }
      })();
    },
    [hideScanOverlay, onBarcodeCaptured]
  );

  usePassiveScannerInput({
    enabled: passiveScanEnabled,
    onCaptureStart: () => showScanOverlay(),
    onCaptureEnd: () => {
      // If the capture ended but no processing started (e.g. too-short scan), undim.
      if (!passiveScanProcessingRef.current) hideScanOverlay();
    },
    onCancel: () => {
      passiveScanProcessingRef.current = false;
      setPassiveScanProcessing(false);
      hideScanOverlay();
    },
    onCapture: (raw) => handlePassiveCapture(raw),
  });

  // Cleanup overlay timer on unmount.
  useEffect(() => {
    return () => {
      if (scanOverlayHideTimerRef.current) {
        window.clearTimeout(scanOverlayHideTimerRef.current);
        scanOverlayHideTimerRef.current = null;
      }
    };
  }, []);

  const resolvePendingScanSelection = useCallback(
    async (customerId: string) => {
      if (!pendingScanResolution) return;
      if (!session?.sessionToken) {
        setScanResolutionError('Not authenticated');
        return;
      }
      setScanResolutionSubmitting(true);
      setScanResolutionError(null);
      try {
        const data = await checkinScan({
          sessionToken: session.sessionToken,
          laneId: lane,
          rawScanText: pendingScanResolution.rawScanText,
          selectedCustomerId: customerId,
        });

        if (data.result === 'ERROR') {
          setScanResolutionError(data.error?.message || 'Failed to resolve scan');
          return;
        }
        if (data.result === 'MATCHED' && data.customer?.id) {
          setPendingScanResolution(null);
          setScanResolutionError(null);
          await startLaneSessionByCustomerId(data.customer.id, { suppressAlerts: true });
          return;
        }

        setScanResolutionError('Could not resolve scan. Please try again.');
      } catch (err) {
        setScanResolutionError(err instanceof Error ? err.message : 'Failed to resolve scan');
      } finally {
        setScanResolutionSubmitting(false);
      }
    },
    [lane, pendingScanResolution, session?.sessionToken, startLaneSessionByCustomerId]
  );

  const handleCreateFromNoMatch = async (): Promise<ScanResult> => {
    if (!pendingCreateFromScan) {
      return { outcome: 'error', message: 'Nothing to create (no pending scan)' };
    }
    if (!session?.sessionToken) {
      return { outcome: 'error', message: 'Not authenticated' };
    }

    const { extracted, idScanValue, idScanHash } = pendingCreateFromScan;
    const firstName = extracted.firstName || '';
    const lastName = extracted.lastName || '';
    const dob = extracted.dob || '';
    if (!firstName || !lastName || !dob) {
      return { outcome: 'error', message: 'Missing required fields to create customer' };
    }

    try {
      const data = await customersCreateFromScan({
        sessionToken: session.sessionToken,
        idScanValue,
        idScanHash: idScanHash || undefined,
        firstName,
        lastName,
        dob,
      });
      const customerId = data.customer?.id;
      if (!customerId) {
        return { outcome: 'error', message: 'Create returned no customer id' };
      }

      setPendingCreateFromScan(null);
      setShowCreateFromScanPrompt(false);
      setCreateFromScanError(null);
      return await startLaneSessionByCustomerId(customerId, { suppressAlerts: true });
    } catch (error) {
      console.error('Failed to create customer from scan:', error);
      return {
        outcome: 'error',
        message: error instanceof Error ? error.message : 'Failed to create customer',
      };
    }
  };

  const handleClearSession = async () => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    try {
      try {
        await laneReset({ sessionToken: session.sessionToken, lane });
      } catch (err) {
        // Reset can be treated as idempotent on the client.
        // If there is no active lane session, the server may respond 404.
        if (!(isApiError(err) && err.status === 404)) {
          throw err;
        }
      }

      patchRegister({
        sessionId: null,
        status: null,
        customerName: '',
        membershipNumber: '',
        customerMembershipValidUntil: null,
        membershipPurchaseIntent: null,
        customerPrimaryLanguage: null,
        customerDobMonthDay: null,
        customerLastVisitAt: null,
        customerNotes: null,
        agreementSigned: false,
        proposedRentalType: null,
        proposedBy: null,
        selectionConfirmed: false,
        selectionConfirmedBy: null,
        selectionAcknowledged: true,
        customerSelectedType: null,
        waitlistDesiredTier: null,
        waitlistBackupType: null,
        assignedResourceType: null,
        assignedResourceNumber: null,
        checkoutAt: null,
        paymentIntentId: null,
        paymentStatus: null,
        paymentQuote: null,
        paymentFailureReason: null,
        pastDueBlocked: false,
        pastDueBalance: 0,
      });
      setManualEntry(false);
      setSelectedRentalType(null);
      setSelectedInventoryItem(null);
      setShowCustomerConfirmationPending(false);
      setCustomerConfirmationType(null);
      setShowWaitlistModal(false);
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
      showAlert('Failed to clear session', 'Error');
    }
  };

  const handleClaimCheckout = async (requestId: string) => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    try {
      await checkoutClaim({ sessionToken: session.sessionToken, requestId });
      setSelectedCheckoutRequest(requestId);

      // Fetch the checkout request details to get checklist
      // For now, we'll get it from the request summary
      const request = checkoutRequests.get(requestId);
      if (request) {
        // We'll need to fetch the full request details to get the checklist
        // For now, initialize empty checklist
        setCheckoutChecklist({});
        setCheckoutItemsConfirmed(false);
        setCheckoutFeePaid(false);
      }
    } catch (error) {
      console.error('Failed to claim checkout:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to claim checkout', 'Error');
    }
  };

  const handleConfirmItems = async (requestId: string) => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    try {
      await checkoutConfirmItems({ sessionToken: session.sessionToken, requestId });
      setCheckoutItemsConfirmed(true);
    } catch (error) {
      console.error('Failed to confirm items:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to confirm items', 'Error');
    }
  };

  const handleMarkFeePaid = async (requestId: string) => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    try {
      await checkoutMarkFeePaid({ sessionToken: session.sessionToken, requestId });
      setCheckoutFeePaid(true);
    } catch (error) {
      console.error('Failed to mark fee as paid:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to mark fee as paid', 'Error');
    }
  };

  const handleCompleteCheckout = async (requestId: string) => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    if (!checkoutItemsConfirmed) {
      showAlert('Please confirm items returned first', 'Validation');
      return;
    }

    const request = checkoutRequests.get(requestId);
    if (request && request.lateFeeAmount > 0 && !checkoutFeePaid) {
      showAlert('Please mark late fee as paid first', 'Validation');
      return;
    }

    setIsSubmitting(true);
    try {
      await checkoutComplete({ sessionToken: session.sessionToken, requestId });
      // Reset checkout state
      setSelectedCheckoutRequest(null);
      setCheckoutChecklist({});
      setCheckoutItemsConfirmed(false);
      setCheckoutFeePaid(false);
    } catch (error) {
      console.error('Failed to complete checkout:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to complete checkout', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Waitlist/Upgrades functions
  const fetchWaitlist = async () => {
    if (!session?.sessionToken) return;

    try {
      // Fetch both ACTIVE and OFFERED waitlist entries
      const [activeData, offeredData] = await Promise.all([
        waitlistList({ sessionToken: session.sessionToken, status: 'ACTIVE' }).catch(() => ({
          entries: [] as typeof waitlistEntries,
        })),
        waitlistList({ sessionToken: session.sessionToken, status: 'OFFERED' }).catch(() => ({
          entries: [] as typeof waitlistEntries,
        })),
      ]);

      const allEntries: typeof waitlistEntries = [];
      allEntries.push(...(activeData.entries || []));
      allEntries.push(...(offeredData.entries || []));

      // De-dupe by id defensively (a record should not appear in both ACTIVE and OFFERED, but
      // during transitions or partial server failures it could). Prefer OFFERED over ACTIVE.
      const statusPriority = (status: string): number =>
        status === 'OFFERED' ? 2 : status === 'ACTIVE' ? 1 : 0;

      const byId = new Map<string, (typeof waitlistEntries)[number]>();
      for (const entry of allEntries) {
        const existing = byId.get(entry.id);
        if (!existing) {
          byId.set(entry.id, entry);
          continue;
        }
        if (statusPriority(entry.status) >= statusPriority(existing.status)) {
          byId.set(entry.id, entry);
        }
      }

      const deduped = Array.from(byId.values());

      // Oldest first (createdAt ascending)
      deduped.sort((a, b) => {
        const at = new Date(a.createdAt).getTime();
        const bt = new Date(b.createdAt).getTime();
        return at - bt;
      });

      setWaitlistEntries(deduped);
    } catch (error) {
      console.error('Failed to fetch waitlist:', error);
    }
  };

  const fetchInventoryAvailable = async () => {
    try {
      const data = await apiInventoryAvailable({ sessionToken: null });
      setInventoryAvailable({
        rooms: data.rooms,
        rawRooms: data.rawRooms,
        waitlistDemand: data.waitlistDemand,
        lockers: typeof data.lockers === 'number' && Number.isFinite(data.lockers) ? data.lockers : 0,
      });
    } catch (error) {
      console.error('Failed to fetch inventory available:', error);
    }
  };

  const fetchDocumentsBySession = useCallback(
    async (laneSessionId: string) => {
      if (!session?.sessionToken) return;
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const data = await documentsBySession({ sessionToken: session.sessionToken, laneSessionId });
        setDocumentsForSession(Array.isArray(data.documents) ? data.documents : []);
      } catch (e) {
        setDocumentsForSession(null);
        setDocumentsError(e instanceof Error ? e.message : 'Failed to load documents');
      } finally {
        setDocumentsLoading(false);
      }
    },
    [session?.sessionToken]
  );

  const downloadAgreementPdf = useCallback(
    async (documentId: string) => {
      if (!session?.sessionToken) return;
      const blob = await documentDownloadPdf({ sessionToken: session.sessionToken, documentId });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    [session?.sessionToken]
  );

  fetchWaitlistRef.current = fetchWaitlist;
  fetchInventoryAvailableRef.current = fetchInventoryAvailable;

  // Fetch waitlist on mount and when session is available
  useEffect(() => {
    if (session?.sessionToken) {
      void fetchWaitlistRef.current?.();
      void fetchInventoryAvailableRef.current?.();
    }
  }, [session?.sessionToken]);

  // 60s polling fallback for waitlist + availability (WebSocket is primary)
  useEffect(() => {
    if (!session?.sessionToken) return;
    const interval = window.setInterval(() => {
      void fetchWaitlistRef.current?.();
      void fetchInventoryAvailableRef.current?.();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [session?.sessionToken]);

  const sessionActive = !!currentSessionId;

  const offeredCountByTier = waitlistEntries.reduce<Record<string, number>>((acc, e) => {
    if (e.status === 'OFFERED') {
      acc[e.desiredTier] = (acc[e.desiredTier] || 0) + 1;
    }
    return acc;
  }, {});

  const isEntryOfferEligible = (entry: (typeof waitlistEntries)[number]): boolean => {
    if (entry.status === 'OFFERED') return true;
    if (entry.status !== 'ACTIVE') return false;
    if (!inventoryAvailable) return false;
    const tier = entry.desiredTier;
    const raw = Number(inventoryAvailable.rawRooms?.[tier] ?? 0);
    const offered = Number(offeredCountByTier[tier] ?? 0);
    return raw - offered > 0;
  };

  const eligibleEntryCount = waitlistEntries.filter(isEntryOfferEligible).length;
  const hasEligibleEntries = eligibleEntryCount > 0;
  const prevSessionActiveRef = useRef<boolean>(false);
  const pulseCandidateRef = useRef<boolean>(false);

  const dismissUpgradePulse = () => {
    pulseCandidateRef.current = false;
    setShowUpgradePulse(false);
  };

  const resetUpgradeState = () => {
    setUpgradePaymentIntentId(null);
    setUpgradeFee(null);
    setUpgradePaymentStatus(null);
    setUpgradeOriginalCharges([]);
    setUpgradeOriginalTotal(null);
    setShowUpgradePaymentModal(false);
    setUpgradeContext(null);
  };

  const openOfferUpgradeModal = (entry: (typeof waitlistEntries)[number]) => {
    if (entry.desiredTier !== 'STANDARD' && entry.desiredTier !== 'DOUBLE' && entry.desiredTier !== 'SPECIAL') {
      showAlert('Only STANDARD/DOUBLE/SPECIAL upgrades can be offered.', 'Validation');
      return;
    }
    dismissUpgradePulse();
    setOfferUpgradeModal({
      waitlistId: entry.id,
      desiredTier: entry.desiredTier,
      customerLabel: entry.customerName || entry.displayIdentifier,
    });
  };

  // When a session ends, arm the pulse (we'll show it once we know upgrades are eligible).
  useEffect(() => {
    const prev = prevSessionActiveRef.current;
    if (prev && !sessionActive) {
      pulseCandidateRef.current = true;
    }
    prevSessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  // If a session just ended and eligible upgrades exist, show the pulse.
  useEffect(() => {
    if (pulseCandidateRef.current && !sessionActive && hasEligibleEntries) {
      setShowUpgradePulse(true);
      pulseCandidateRef.current = false;
    }
  }, [hasEligibleEntries, sessionActive]);

  const handleStartUpgradePayment = async (entry: (typeof waitlistEntries)[number]) => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }
    if (!entry.roomId) {
      showAlert('No reserved room found for this offer. Refresh and retry.', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await upgradesFulfill({
        sessionToken: session.sessionToken,
        waitlistId: entry.id,
        roomId: entry.roomId,
        acknowledgedDisclaimer: true,
      });

      setSelectedWaitlistEntry(entry.id);
      const intentId = payload.paymentIntentId ?? null;
      setUpgradePaymentIntentId(intentId);
      setUpgradeFee(
        typeof payload.upgradeFee === 'number' && Number.isFinite(payload.upgradeFee)
          ? payload.upgradeFee
          : null
      );
      setUpgradePaymentStatus(intentId ? 'DUE' : null);
      setUpgradeOriginalCharges(payload.originalCharges || []);
      setUpgradeOriginalTotal(
        typeof payload.originalTotal === 'number' && Number.isFinite(payload.originalTotal)
          ? payload.originalTotal
          : null
      );
      setUpgradeContext({
        waitlistId: entry.id,
        customerLabel: entry.customerName || entry.displayIdentifier,
        offeredRoomNumber: entry.offeredRoomNumber,
        newRoomNumber: payload.newRoomNumber ?? entry.offeredRoomNumber ?? null,
      });
      dismissUpgradePulse();
      setIsUpgradesDrawerOpen(true);
      setShowUpgradePaymentModal(true);
    } catch (error) {
      console.error('Failed to start upgrade:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to start upgrade', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgradePaymentDecline = (reason?: string) => {
    setPaymentDeclineError(reason || 'Payment declined');
    setUpgradePaymentStatus('DUE');
  };

  const handleUpgradePaymentFlow = async (method: 'CREDIT' | 'CASH') => {
    if (!upgradePaymentIntentId || !session?.sessionToken || !upgradeContext) {
      showAlert('No upgrade payment intent available.', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentsMarkPaid({
        sessionToken: session.sessionToken,
        paymentIntentId: upgradePaymentIntentId,
        squareTransactionId: method === 'CASH' ? 'demo-cash-success' : 'demo-credit-success',
      });

      setUpgradePaymentStatus('PAID');

      await upgradesComplete({
        sessionToken: session.sessionToken,
        waitlistId: upgradeContext.waitlistId,
        paymentIntentId: upgradePaymentIntentId,
      });

      resetUpgradeState();
      setSelectedWaitlistEntry(null);
      setShowUpgradePaymentModal(false);
      await fetchWaitlistRef.current?.();
      await fetchInventoryAvailableRef.current?.();
      dismissUpgradePulse();
    } catch (error) {
      console.error('Failed to process upgrade payment:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to process upgrade payment', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Check API health (avoid JSON parse crashes on empty/non-JSON responses)
    let cancelled = false;
    void (async () => {
      try {
        const next = await getHealth({ sessionToken: null });
        if (!cancelled && next) setHealth(next);
      } catch (err) {
        console.error('Health check failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lane]);

  const ws = useEmployeeRegisterWs({
    lane,
    dispatchRegister,
    selectedCheckoutRequestRef,
    currentSessionIdRef,
    customerSelectedTypeRef,
    setCheckoutRequests,
    setSelectedCheckoutRequest,
    setCheckoutChecklist,
    setCheckoutItemsConfirmed,
    setCheckoutFeePaid,
    setSelectedInventoryItem,
    setShowCustomerConfirmationPending,
    setCustomerConfirmationType,
    fetchWaitlist: () => void fetchWaitlistRef.current?.(),
    fetchInventoryAvailable: () => void fetchInventoryAvailableRef.current?.(),
  });

  useEffect(() => {
    setWsConnected(ws.connected);
  }, [ws.connected]);

  const handleInventorySelect = (
    type: 'room' | 'locker',
    id: string,
    number: string,
    tier: string
  ) => {
    // Check if employee selected different type than customer requested
    if (customerSelectedType && tier !== customerSelectedType) {
      // Require customer confirmation
      setCustomerConfirmationType({
        requested: customerSelectedType,
        selected: tier,
        number,
      });
      setShowCustomerConfirmationPending(true);

      // Send confirmation request to customer kiosk via WebSocket
      // This would be handled by the API/WebSocket broadcaster
      // For now, we'll show a modal
    }

    setSelectedInventoryItem({ type, id, number, tier });
  };

  const handleProposeSelection = async (rentalType: string) => {
    if (!currentSessionId || !session?.sessionToken) {
      return;
    }

    // Second tap on same rental forces selection
    if (proposedRentalType === rentalType && !selectionConfirmed) {
      await handleConfirmSelection();
      return;
    }

    setIsSubmitting(true);
    try {
      await proposeSelection({
        sessionToken: session.sessionToken,
        lane,
        rentalType,
        proposedBy: 'EMPLOYEE',
      });
      patchRegister({ proposedRentalType: rentalType, proposedBy: 'EMPLOYEE' });
    } catch (error) {
      console.error('Failed to propose selection:', error);
      showAlert(
        error instanceof Error ? error.message : 'Failed to propose selection. Please try again.',
        'Error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (!currentSessionId || !session?.sessionToken || !proposedRentalType) {
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmSelection({
        sessionToken: session.sessionToken,
        lane,
        confirmedBy: 'EMPLOYEE',
      });
      patchRegister({
        selectionConfirmed: true,
        selectionConfirmedBy: 'EMPLOYEE',
        selectionAcknowledged: true,
        customerSelectedType: proposedRentalType,
      });
    } catch (error) {
      console.error('Failed to confirm selection:', error);
      showAlert(
        error instanceof Error ? error.message : 'Failed to confirm selection. Please try again.',
        'Error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Corrected demo flow: once selection is confirmed/locked, create payment intent (no assignment required).
  useEffect(() => {
    if (!currentSessionId || !session?.sessionToken) return;
    if (!selectionConfirmed) return;
    if (paymentIntentId || paymentStatus === 'DUE' || paymentStatus === 'PAID') return;
    if (paymentIntentCreateInFlightRef.current) return;

    paymentIntentCreateInFlightRef.current = true;
    void handleCreatePaymentIntent().finally(() => {
      paymentIntentCreateInFlightRef.current = false;
    });
  }, [currentSessionId, session?.sessionToken, selectionConfirmed, paymentIntentId, paymentStatus]);

  const handleAssign = async () => {
    if (!selectedInventoryItem || !currentSessionId || !session?.sessionToken) {
      showAlert('Please select an item to assign', 'Validation');
      return;
    }

    // Guardrails: Prevent assignment if conditions not met
    if (showCustomerConfirmationPending) {
      showAlert('Please wait for customer confirmation before assigning', 'Validation');
      return;
    }

    if (!agreementSigned) {
      showAlert(
        'Agreement must be signed before assignment. Please wait for customer to sign the agreement.',
        'Validation'
      );
      return;
    }

    if (paymentStatus !== 'PAID') {
      showAlert(
        'Payment must be marked as paid before assignment. Please mark payment as paid in Square first.',
        'Validation'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Use new check-in assign endpoint
      let data: { needsConfirmation?: boolean };
      try {
        data = await assignResource({
          sessionToken: session.sessionToken,
          lane,
          resourceType: selectedInventoryItem.type,
          resourceId: selectedInventoryItem.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : null;
        const body = isApiError(err) ? err.body : null;
        if (
          isRecord(body) &&
          (body.raceLost === true || (typeof msg === 'string' && msg.includes('already assigned')))
        ) {
          // Race condition - refresh inventory and re-select
          showAlert('Item no longer available. Refreshing inventory...', 'Error');
          setSelectedInventoryItem(null);
          // InventorySelector will auto-refresh and re-select
          return;
        }
        throw err;
      }

      console.log('Assignment successful:', data);

      // If cross-type assignment, wait for customer confirmation
      if (data.needsConfirmation === true) {
        setShowCustomerConfirmationPending(true);
        setIsSubmitting(false);
        return;
      }

      // Assignment occurs after payment + agreement in the corrected flow; nothing payment-related here.
    } catch (error) {
      console.error('Failed to assign:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to assign', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePaymentIntent = async () => {
    if (!currentSessionId || !session?.sessionToken) {
      return;
    }

    try {
      const data = await createPaymentIntent({ sessionToken: session.sessionToken, lane });
      if (typeof data.paymentIntentId === 'string') {
        patchRegister({ paymentIntentId: data.paymentIntentId });
      }
      patchRegister({ paymentQuote: data.quote ?? null, paymentStatus: 'DUE' });
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to create payment intent', 'Error');
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentIntentId || !session?.sessionToken) {
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentsMarkPaid({
        sessionToken: session.sessionToken,
        paymentIntentId,
        squareTransactionId: undefined, // Would come from Square POS integration
      });
      patchRegister({ paymentStatus: 'PAID' });
      // Payment marked paid - customer can now sign agreement
    } catch (error) {
      console.error('Failed to mark payment as paid:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to mark payment as paid', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteMembershipPurchase = async (membershipNumberOverride?: string) => {
    if (!session?.sessionToken || !currentSessionId) {
      showAlert('Not authenticated', 'Error');
      return;
    }
    const membershipNumberToSave = (membershipNumberOverride ?? membershipIdInput).trim();
    if (!membershipNumberToSave) {
      setMembershipIdError('Membership number is required');
      return;
    }

    setMembershipIdSubmitting(true);
    setMembershipIdError(null);
    try {
      await completeMembershipPurchase({
        sessionToken: session.sessionToken,
        lane,
        sessionId: currentSessionId,
        membershipNumber: membershipNumberToSave,
      });
      // Server will broadcast updated membership + clear pending intent.
      setShowMembershipIdPrompt(false);
      setMembershipIdInput('');
      setMembershipIdPromptedForSessionId(null);
    } catch (error) {
      console.error('Failed to complete membership purchase:', error);
      setMembershipIdError(error instanceof Error ? error.message : 'Failed to save membership number');
    } finally {
      setMembershipIdSubmitting(false);
    }
  };

  // Auto-prompt for membership ID after payment is accepted when a membership purchase intent is present.
  useEffect(() => {
    if (!currentSessionId) return;
    if (paymentStatus !== 'PAID') return;
    if (!membershipPurchaseIntent) return;
    // If membership is already active, no prompt needed.
    if (
      getCustomerMembershipStatus({
        membershipNumber: membershipNumber || null,
        membershipValidUntil: customerMembershipValidUntil,
      }) === 'ACTIVE'
    ) {
      return;
    }
    if (!paymentQuote?.lineItems?.some((li) => li.description === '6 Month Membership')) return;
    if (showMembershipIdPrompt) return;
    if (membershipIdPromptedForSessionId === currentSessionId) return;

    setMembershipIdPromptedForSessionId(currentSessionId);
    // Renewal supports keeping the same membership number (explicit option).
    if (membershipPurchaseIntent === 'RENEW' && membershipNumber) {
      setMembershipIdMode('KEEP_EXISTING');
      setMembershipIdInput(membershipNumber);
    } else {
      setMembershipIdMode('ENTER_NEW');
      setMembershipIdInput(membershipNumber || '');
    }
    setMembershipIdError(null);
    setShowMembershipIdPrompt(true);
  }, [
    currentSessionId,
    paymentStatus,
    membershipPurchaseIntent,
    paymentQuote,
    showMembershipIdPrompt,
    membershipIdPromptedForSessionId,
    membershipNumber,
    customerMembershipValidUntil,
  ]);

  // If server clears the pending intent (membership activated), close the prompt.
  useEffect(() => {
    if (membershipPurchaseIntent) return;
    if (!showMembershipIdPrompt) return;
    setShowMembershipIdPrompt(false);
    setMembershipIdInput('');
    setMembershipIdMode('ENTER_NEW');
    setMembershipIdError(null);
    setMembershipIdPromptedForSessionId(null);
  }, [membershipPurchaseIntent, showMembershipIdPrompt]);

  const handleClearSelection = () => {
    setSelectedInventoryItem(null);
  };

  const handleManualSignatureOverride = async () => {
    if (!session?.sessionToken || !currentSessionId) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await manualSignatureOverride({
        sessionToken: session.sessionToken,
        lane,
        sessionId: currentSessionId,
      });
    } catch (error) {
      console.error('Failed to process manual signature override:', error);
      showAlert(
        error instanceof Error ? error.message : 'Failed to process manual signature override',
        'Error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Past-due payment handlers
  const handlePastDuePayment = async (
    outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE',
    declineReason?: string
  ) => {
    if (!session?.sessionToken || !currentSessionId) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await pastDueDemoPayment({
        sessionToken: session.sessionToken,
        lane,
        outcome,
        declineReason,
      });
      if (outcome === 'CREDIT_DECLINE') {
        setPaymentDeclineError(declineReason || 'Payment declined');
      } else {
        setShowPastDueModal(false);
        setPaymentDeclineError(null);
      }
    } catch (error) {
      console.error('Failed to process past-due payment:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to process payment', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pastDueLineItems = useMemo(() => {
    const items: Array<{ description: string; amount: number }> = [];
    const notes = customerNotes || '';
    for (const line of notes.split('\n')) {
      const m = line.match(
        /^\[SYSTEM_LATE_FEE_PENDING\]\s+Late fee\s+\(\$(\d+(?:\.\d{2})?)\):\s+customer was\s+(.+)\s+late on last visit on\s+(\d{4}-\d{2}-\d{2})\./
      );
      if (!m) continue;
      const amount = Number.parseFloat(m[1]!);
      const dur = m[2]!.trim();
      const date = m[3]!;
      if (!Number.isFinite(amount)) continue;
      items.push({
        description: `Late fee (last visit ${date}, ${dur} late)`,
        amount,
      });
    }

    if (items.length === 0 && pastDueBalance > 0) {
      items.push({ description: 'Past due balance', amount: pastDueBalance });
    }

    return items;
  }, [customerNotes, pastDueBalance]);

  const handleManagerBypass = async () => {
    if (!session?.sessionToken || !currentSessionId || !managerId || !managerPin) {
      showAlert('Please select manager and enter PIN', 'Validation');
      return;
    }

    setIsSubmitting(true);
    try {
      await pastDueBypass({
        sessionToken: session.sessionToken,
        lane,
        managerId,
        managerPin,
      });
      setShowManagerBypassModal(false);
      setManagerId('');
      setManagerPin('');
      setPaymentDeclineError(null);
    } catch (error) {
      console.error('Failed to bypass past-due:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to bypass past-due', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Notes handler
  const handleAddNote = async () => {
    if (!session?.sessionToken || !currentSessionId || !newNoteText.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addNote({
        sessionToken: session.sessionToken,
        lane,
        note: newNoteText.trim(),
      });
      setShowAddNoteModal(false);
      setNewNoteText('');
    } catch (error) {
      console.error('Failed to add note:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to add note', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pay-first demo handlers
  const handleDemoPayment = async (
    outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE',
    declineReason?: string
  ) => {
    if (!session?.sessionToken || !currentSessionId) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await demoTakePayment({
        sessionToken: session.sessionToken,
        lane,
        outcome,
        declineReason,
        registerNumber: registerSession?.registerNumber,
      });
      if (outcome === 'CREDIT_DECLINE') {
        setPaymentDeclineError(declineReason || 'Payment declined');
      } else {
        setPaymentDeclineError(null);
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to process payment', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete transaction handler
  const handleCompleteTransaction = async () => {
    if (!session?.sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await laneReset({ sessionToken: session.sessionToken, lane });
      // Reset all state
      patchRegister({
        sessionId: null,
        status: null,
        customerName: '',
        membershipNumber: '',
        customerMembershipValidUntil: null,
        membershipPurchaseIntent: null,
        customerPrimaryLanguage: null,
        customerDobMonthDay: null,
        customerLastVisitAt: null,
        customerNotes: null,
        agreementSigned: false,
        proposedRentalType: null,
        proposedBy: null,
        selectionConfirmed: false,
        selectionConfirmedBy: null,
        selectionAcknowledged: true,
        customerSelectedType: null,
        waitlistDesiredTier: null,
        waitlistBackupType: null,
        assignedResourceType: null,
        assignedResourceNumber: null,
        checkoutAt: null,
        paymentIntentId: null,
        paymentStatus: null,
        paymentQuote: null,
        paymentFailureReason: null,
        pastDueBlocked: false,
        pastDueBalance: 0,
      });
      setSelectedRentalType(null);
      setSelectedInventoryItem(null);
      setPaymentDeclineError(null);
    } catch (error) {
      console.error('Failed to complete transaction:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to complete transaction', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch managers for bypass modal
  useEffect(() => {
    if (showManagerBypassModal && session?.sessionToken) {
      void (async () => {
        try {
          const data = await employeesAvailable({ sessionToken: session.sessionToken });
          const managers = (data.employees || [])
            .filter((e) => e && typeof e.role === 'string')
            .filter((e) => e.role === 'ADMIN')
            .map((e) => ({ id: String(e.id), name: String(e.name) }));
          setManagerList(managers);
        } catch (e) {
          console.error(e);
          setManagerList([]);
        }
      })();
    }
  }, [showManagerBypassModal, session?.sessionToken]);

  const topActions = useRegisterTopActionsOverlays({
    sessionToken: session?.sessionToken ?? null,
    staffId: session?.staffId ?? null,
  });

  return (
    <RegisterSignIn deviceId={deviceId} onSignedIn={handleRegisterSignIn}>
      {!registerSession ? (
        <div />
      ) : !session ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Loading...</div>
      ) : (
        <div className="container" style={{ marginTop: '60px' }}>
          <RegisterSideDrawers
            upgradesOpen={isUpgradesDrawerOpen}
            onUpgradesOpenChange={(next) => {
              if (next) dismissUpgradePulse();
              setIsUpgradesDrawerOpen(next);
            }}
            inventoryOpen={isInventoryDrawerOpen}
            onInventoryOpenChange={setIsInventoryDrawerOpen}
            upgradesAttention={false}
            upgradesTabVariant={hasEligibleEntries ? 'success' : 'secondary'}
            upgradesTabPulseVariant={hasEligibleEntries ? 'success' : null}
            inventoryTabVariant={inventoryHasLate ? 'danger' : 'secondary'}
            inventoryTabPulseVariant={inventoryHasLate ? 'danger' : null}
            upgradesContent={
              <UpgradesDrawerContent
                waitlistEntries={waitlistEntries}
                hasEligibleEntries={hasEligibleEntries}
                isEntryOfferEligible={(entryId, status, desiredTier) => {
                  const entry = waitlistEntries.find((e) => e.id === entryId);
                  if (!entry) return false;
                  if (entry.status !== status) return false;
                  if (entry.desiredTier !== desiredTier) return false;
                  return isEntryOfferEligible(entry);
                }}
                onOffer={(entryId) => {
                  const entry = waitlistEntries.find((e) => e.id === entryId);
                  if (!entry) return;
                  openOfferUpgradeModal(entry);
                  setIsUpgradesDrawerOpen(true);
                }}
                onStartPayment={(entry) => {
                  resetUpgradeState();
                  setSelectedWaitlistEntry(entry.id);
                  void handleStartUpgradePayment(entry);
                }}
                onCancelOffer={(entryId) => {
                  // Cancellation endpoint not yet implemented in this demo UI.
                  showAlert(`Cancel offer not implemented yet (waitlistId=${entryId}).`, 'Notice');
                }}
                isSubmitting={isSubmitting}
              />
            }
            inventoryContent={
              <InventoryDrawer
                lane={lane}
                sessionToken={session.sessionToken}
                forcedExpandedSection={inventoryForcedSection}
                onExpandedSectionChange={setInventoryForcedSection}
                customerSelectedType={customerSelectedType}
                waitlistDesiredTier={waitlistDesiredTier}
                waitlistBackupType={waitlistBackupType}
                onSelect={handleInventorySelect}
                onClearSelection={() => setSelectedInventoryItem(null)}
                selectedItem={selectedInventoryItem}
                sessionId={currentSessionId}
                disableSelection={false}
                onAlertSummaryChange={({ hasLate }) => setInventoryHasLate(hasLate)}
              />
            }
          />

          {scanOverlayMounted && (
            <div
              className={[
                'er-scan-processing-overlay',
                scanOverlayActive ? 'er-scan-processing-overlay--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            >
              <div className="er-scan-processing-card rounded-xl bg-slate-900/70 text-white ring-1 ring-slate-700">
                <span className="er-spinner" aria-hidden="true" />
                <span className="er-scan-processing-text">Processing scan…</span>
              </div>
            </div>
          )}

          {/* Checkout Request Notifications */}
          {checkoutRequests.size > 0 && !selectedCheckoutRequest && (
            <CheckoutRequestsBanner
              requests={Array.from(checkoutRequests.values())}
              onClaim={(id) => void handleClaimCheckout(id)}
            />
          )}

          {/* Checkout Verification Screen */}
          {selectedCheckoutRequest &&
            (() => {
              const request = checkoutRequests.get(selectedCheckoutRequest);
              if (!request) return null;
              return (
                <CheckoutVerificationModal
                  request={request}
                  isSubmitting={isSubmitting}
                  checkoutItemsConfirmed={checkoutItemsConfirmed}
                  checkoutFeePaid={checkoutFeePaid}
                  onConfirmItems={() => void handleConfirmItems(selectedCheckoutRequest)}
                  onMarkFeePaid={() => void handleMarkFeePaid(selectedCheckoutRequest)}
                  onComplete={() => void handleCompleteCheckout(selectedCheckoutRequest)}
                  onCancel={() => {
                    setSelectedCheckoutRequest(null);
                    setCheckoutChecklist({});
                    setCheckoutItemsConfirmed(false);
                    setCheckoutFeePaid(false);
                  }}
                />
              );
            })()}

          <RegisterHeader
            health={health}
            wsConnected={wsConnected}
            lane={lane}
            staffName={session.name}
            staffRole={session.role}
            onSignOut={() => void handleLogout()}
            onCloseOut={() => void handleCloseOut()}
          />

          <RegisterTopActionsBar
            onCheckout={topActions.openCheckout}
            onRoomCleaning={topActions.openRoomCleaning}
          />

          <RegisterMainView
            currentSessionId={currentSessionId}
            customerName={customerName}
            customerPrimaryLanguage={customerPrimaryLanguage ?? null}
            customerDobMonthDay={customerDobMonthDay ?? null}
            customerLastVisitAt={customerLastVisitAt ?? null}
            pastDueBalance={pastDueBalance}
            customerNotes={customerNotes ?? null}
            onAddNote={() => setShowAddNoteModal(true)}
            waitlistDesiredTier={waitlistDesiredTier}
            waitlistBackupType={waitlistBackupType}
            proposedRentalType={proposedRentalType}
            proposedBy={proposedBy}
            selectionConfirmed={selectionConfirmed}
            selectionConfirmedBy={selectionConfirmedBy}
            onConfirmSelection={() => void handleConfirmSelection()}
            pastDueBlocked={pastDueBlocked}
            isSubmitting={isSubmitting}
            onProposeSelection={(rentalType) => void handleProposeSelection(rentalType)}
            inventoryAvailable={inventoryAvailable}
            onOpenInventorySection={(section) => {
              setInventoryForcedSection(section);
              setIsInventoryDrawerOpen(true);
            }}
            selectedInventoryItem={selectedInventoryItem}
            customerSelectedType={customerSelectedType}
            showCustomerConfirmationPending={showCustomerConfirmationPending}
            agreementSigned={agreementSigned}
            paymentStatus={paymentStatus}
            paymentQuote={paymentQuote}
            onAssign={() => void handleAssign()}
            onManualSignatureOverride={() => void handleManualSignatureOverride()}
            onClearSelection={handleClearSelection}
            onMarkPaid={() => void handleMarkPaid()}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customerSearchLoading={customerSearchLoading}
            customerSuggestions={customerSuggestions}
            selectedCustomerId={selectedCustomerId}
            selectedCustomerLabel={selectedCustomerLabel}
            setSelectedCustomerId={setSelectedCustomerId}
            setSelectedCustomerLabel={setSelectedCustomerLabel}
            onConfirmCustomerSelection={() => void handleConfirmCustomerSelection()}
            manualEntry={manualEntry}
            setManualEntry={setManualEntry}
            manualFirstName={manualFirstName}
            setManualFirstName={setManualFirstName}
            manualLastName={manualLastName}
            setManualLastName={setManualLastName}
            manualDobDigits={manualDobDigits}
            setManualDobDigits={setManualDobDigits}
            onManualSubmit={(e) => void handleManualSubmit(e)}
            manualEntrySubmitting={manualEntrySubmitting}
            onClearSession={() => void handleClearSession()}
            membershipNumber={membershipNumber}
          />

          <footer className="footer">
            <p>Employee-facing tablet • Runs alongside Square POS</p>
          </footer>

          <WaitlistNoticeModal
            isOpen={showWaitlistModal && !!waitlistDesiredTier && !!waitlistBackupType}
            desiredTier={waitlistDesiredTier || ''}
            backupType={waitlistBackupType || ''}
            onClose={() => setShowWaitlistModal(false)}
          />

          <AlreadyCheckedInModal
            isOpen={!!alreadyCheckedIn}
            customerLabel={alreadyCheckedIn?.customerLabel || null}
            activeCheckin={alreadyCheckedIn?.activeCheckin || null}
            onClose={() => setAlreadyCheckedIn(null)}
          />

          {offerUpgradeModal && session?.sessionToken && (
            <OfferUpgradeModal
              isOpen={true}
              onClose={() => setOfferUpgradeModal(null)}
              sessionToken={session.sessionToken}
              waitlistId={offerUpgradeModal.waitlistId}
              desiredTier={offerUpgradeModal.desiredTier}
              customerLabel={offerUpgradeModal.customerLabel}
              onOffered={() => {
                void fetchWaitlistRef.current?.();
                void fetchInventoryAvailableRef.current?.();
              }}
            />
          )}

          <CustomerConfirmationPendingModal
            isOpen={showCustomerConfirmationPending && !!customerConfirmationType}
            data={customerConfirmationType || { requested: '', selected: '', number: '' }}
            onCancel={
              customerConfirmationType
                ? () => {
                    setShowCustomerConfirmationPending(false);
                    setCustomerConfirmationType(null);
                    setSelectedInventoryItem(null);
                  }
                : undefined
            }
          />

          <MultipleMatchesModal
            isOpen={!!pendingScanResolution}
            candidates={pendingScanResolution?.candidates || []}
            errorMessage={scanResolutionError}
            isSubmitting={scanResolutionSubmitting}
            onCancel={() => {
              setPendingScanResolution(null);
              setScanResolutionError(null);
            }}
            onSelect={(customerId) => void resolvePendingScanSelection(customerId)}
          />

          <ModalFrame
            isOpen={!!manualExistingPrompt}
            title="Existing customer found"
            onClose={() => {
              setManualExistingPrompt(null);
              setManualExistingPromptError(null);
              setManualExistingPromptSubmitting(false);
            }}
            maxWidth="640px"
            closeOnOverlayClick={false}
          >
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ color: '#94a3b8' }}>
                An existing customer already matches this First Name, Last Name, and Date of Birth. Do you want to continue?
              </div>

              {manualExistingPrompt?.matchCount && manualExistingPrompt.matchCount > 1 ? (
                <div style={{ color: '#f59e0b', fontWeight: 800 }}>
                  {manualExistingPrompt.matchCount} matching customers found. Showing best match:
                </div>
              ) : null}

              {manualExistingPrompt ? (
                <Card padding="md" className="bg-slate-900/70 text-white ring-slate-700">
                  <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{manualExistingPrompt.bestMatch.name}</div>
                  <div style={{ marginTop: '0.25rem', color: '#94a3b8', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>
                      DOB:{' '}
                      <strong style={{ color: 'white' }}>
                        {manualExistingPrompt.bestMatch.dob || manualExistingPrompt.dobIso}
                      </strong>
                    </span>
                    {manualExistingPrompt.bestMatch.membershipNumber ? (
                      <span>
                        Membership:{' '}
                        <strong style={{ color: 'white' }}>{manualExistingPrompt.bestMatch.membershipNumber}</strong>
                      </span>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              {manualExistingPromptError ? (
                <div
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 12,
                    color: '#fecaca',
                    fontWeight: 800,
                  }}
                >
                  {manualExistingPromptError}
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={manualExistingPromptSubmitting || isSubmitting}
                  onClick={() => {
                    setManualExistingPrompt(null);
                    setManualExistingPromptError(null);
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={manualExistingPromptSubmitting || isSubmitting || !manualExistingPrompt}
                  onClick={() => {
                    if (!manualExistingPrompt) return;
                    void (async () => {
                      setManualExistingPromptSubmitting(true);
                      setManualExistingPromptError(null);
                      try {
                        const result = await startLaneSessionByCustomerId(manualExistingPrompt.bestMatch.id, {
                          suppressAlerts: true,
                        });
                        if (result.outcome === 'matched') {
                          setManualExistingPrompt(null);
                          setManualEntry(false);
                          setManualFirstName('');
                          setManualLastName('');
                          setManualDobDigits('');
                        }
                      } catch (err) {
                        setManualExistingPromptError(err instanceof Error ? err.message : 'Failed to load existing customer');
                      } finally {
                        setManualExistingPromptSubmitting(false);
                      }
                    })();
                  }}
                >
                  Existing Customer
                </Button>

                <Button
                  type="button"
                  disabled={manualExistingPromptSubmitting || isSubmitting || !manualExistingPrompt || !session?.sessionToken}
                  onClick={() => {
                    if (!manualExistingPrompt || !session?.sessionToken) return;
                    void (async () => {
                      setManualExistingPromptSubmitting(true);
                      setManualExistingPromptError(null);
                      try {
                        const { firstName, lastName, dobIso } = manualExistingPrompt;
                        let created: { customer?: { id?: string } };
                        try {
                          created = await customersCreateManual({
                            sessionToken: session.sessionToken,
                            firstName,
                            lastName,
                            dob: dobIso,
                          });
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Failed to create customer';
                          setManualExistingPromptError(msg);
                          return;
                        }
                        const newId = created.customer?.id;
                        if (!newId) {
                          setManualExistingPromptError('Create returned no customer id');
                          return;
                        }
                        const result = await startLaneSessionByCustomerId(newId, { suppressAlerts: true });
                        if (result.outcome === 'matched') {
                          setManualExistingPrompt(null);
                          setManualEntry(false);
                          setManualFirstName('');
                          setManualLastName('');
                          setManualDobDigits('');
                        }
                      } finally {
                        setManualExistingPromptSubmitting(false);
                      }
                    })();
                  }}
                >
                  Add Customer
                </Button>
              </div>
            </div>
          </ModalFrame>

          <ModalFrame
            isOpen={showCreateFromScanPrompt && !!pendingCreateFromScan}
            title="No match found"
            onClose={() => {
              setShowCreateFromScanPrompt(false);
              setPendingCreateFromScan(null);
              setCreateFromScanError(null);
              setCreateFromScanSubmitting(false);
            }}
            maxWidth="720px"
            closeOnOverlayClick={false}
          >
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ color: '#94a3b8' }}>
                Create a new customer profile using the scanned First Name, Last Name, and DOB.
              </div>

              {createFromScanError ? (
                <div
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 12,
                    color: '#fecaca',
                    fontWeight: 800,
                  }}
                >
                  {createFromScanError}
                </div>
              ) : null}

              <Card padding="md" className="bg-slate-900/70 text-white ring-slate-700">
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#94a3b8' }}>
                  <span>
                    First: <strong style={{ color: 'white' }}>{pendingCreateFromScan?.extracted.firstName || '—'}</strong>
                  </span>
                  <span>
                    Last: <strong style={{ color: 'white' }}>{pendingCreateFromScan?.extracted.lastName || '—'}</strong>
                  </span>
                  <span>
                    DOB: <strong style={{ color: 'white' }}>{pendingCreateFromScan?.extracted.dob || '—'}</strong>
                  </span>
                </div>
              </Card>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  disabled={createFromScanSubmitting || isSubmitting}
                  onClick={() => {
                    setShowCreateFromScanPrompt(false);
                    setPendingCreateFromScan(null);
                    setCreateFromScanError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={createFromScanSubmitting || isSubmitting || !pendingCreateFromScan}
                  onClick={() => {
                    void (async () => {
                      setCreateFromScanSubmitting(true);
                      setCreateFromScanError(null);
                      try {
                        const r = await handleCreateFromNoMatch();
                        if (r.outcome !== 'matched') {
                          setCreateFromScanError(r.message);
                        }
                      } finally {
                        setCreateFromScanSubmitting(false);
                      }
                    })();
                  }}
                >
                  {createFromScanSubmitting ? 'Creating…' : 'Create Customer'}
                </Button>
              </div>
            </div>
          </ModalFrame>

          {pastDueBalance > 0 && (
            <PastDuePaymentModal
              isOpen={showPastDueModal}
              quote={{
                total: pastDueBalance,
                lineItems: pastDueLineItems,
                messages: [],
              }}
              onPayInSquare={(outcome, reason) => void handlePastDuePayment(outcome, reason)}
              onManagerBypass={() => {
                setShowPastDueModal(false);
                setShowManagerBypassModal(true);
              }}
              onClose={() => setShowPastDueModal(false)}
              isSubmitting={isSubmitting}
            />
          )}

          <MembershipIdPromptModal
            isOpen={showMembershipIdPrompt}
            membershipIdMode={membershipIdMode}
            membershipIdInput={membershipIdInput}
            membershipNumber={membershipNumber}
            membershipPurchaseIntent={membershipPurchaseIntent}
            error={membershipIdError}
            isSubmitting={membershipIdSubmitting}
            onModeChange={(mode) => {
              setMembershipIdMode(mode);
              if (mode === 'KEEP_EXISTING' && membershipNumber) {
                setMembershipIdInput(membershipNumber);
              } else {
                setMembershipIdInput('');
              }
              setMembershipIdError(null);
            }}
            onInputChange={setMembershipIdInput}
            onConfirm={(membershipId) => void handleCompleteMembershipPurchase(membershipId)}
            onNotNow={() => {
              setShowMembershipIdPrompt(false);
              setMembershipIdError(null);
            }}
          />

          <ManagerBypassModal
            isOpen={showManagerBypassModal}
            managers={managerList}
            managerId={managerId}
            managerPin={managerPin}
            onChangeManagerId={setManagerId}
            onChangeManagerPin={setManagerPin}
            onBypass={() => void handleManagerBypass()}
            onCancel={() => {
              setShowManagerBypassModal(false);
              setManagerId('');
              setManagerPin('');
            }}
            isSubmitting={isSubmitting}
          />

          {upgradeContext && (
            <UpgradePaymentModal
              isOpen={showUpgradePaymentModal}
              onClose={() => setShowUpgradePaymentModal(false)}
              customerLabel={upgradeContext.customerLabel}
              newRoomNumber={upgradeContext.newRoomNumber}
              offeredRoomNumber={upgradeContext.offeredRoomNumber}
              originalCharges={upgradeOriginalCharges}
              originalTotal={upgradeOriginalTotal}
              upgradeFee={upgradeFee}
              paymentStatus={upgradePaymentStatus}
              isSubmitting={isSubmitting}
              canComplete={!!upgradePaymentIntentId}
              onPayCreditSuccess={() => void handleUpgradePaymentFlow('CREDIT')}
              onPayCashSuccess={() => void handleUpgradePaymentFlow('CASH')}
              onDecline={() => handleUpgradePaymentDecline('Credit declined')}
              onComplete={() => {
                if (upgradePaymentIntentId) {
                  void handleUpgradePaymentFlow('CREDIT');
                }
              }}
            />
          )}

          <AddNoteModal
            isOpen={showAddNoteModal}
            noteText={newNoteText}
            onChangeNoteText={setNewNoteText}
            onSubmit={() => void handleAddNote()}
            onCancel={() => {
              setShowAddNoteModal(false);
              setNewNoteText('');
            }}
            isSubmitting={isSubmitting}
          />

          <PaymentDeclineToast message={paymentDeclineError} onDismiss={() => setPaymentDeclineError(null)} />
          <ScanToastOverlay message={scanToastMessage} onDismiss={() => setScanToastMessage(null)} />
          <AlertModal
            open={Boolean(alertModal)}
            title={alertModal?.title}
            message={alertModal?.message ?? ''}
            onClose={() => setAlertModal(null)}
          />
          {topActions.overlays}

          {/* Agreement + Assignment Display */}
          <TransactionCompleteModal
            isOpen={Boolean(currentSessionId && customerName && assignedResourceType && assignedResourceNumber)}
            agreementPending={!agreementSigned && selectionConfirmed && paymentStatus === 'PAID'}
            assignedLabel={assignedResourceType === 'room' ? 'Room' : 'Locker'}
            assignedNumber={assignedResourceNumber || '—'}
            checkoutAt={checkoutAt}
            verifyDisabled={!session?.sessionToken || !currentSessionIdRef.current}
            showComplete={Boolean(agreementSigned && assignedResourceType)}
            completeLabel={isSubmitting ? 'Processing...' : 'Complete Transaction'}
            completeDisabled={isSubmitting}
            onVerifyAgreementArtifacts={() => {
              const sid = currentSessionIdRef.current;
              if (!sid) return;
              setDocumentsModalOpen(true);
              void fetchDocumentsBySession(sid);
            }}
            onCompleteTransaction={() => void handleCompleteTransaction()}
          />

          {/* Pay-First Demo Buttons (after selection confirmed) */}
          {currentSessionId &&
            customerName &&
            selectionConfirmed &&
            paymentQuote &&
            paymentStatus === 'DUE' &&
            !pastDueBlocked && (
              <RequiredTenderOutcomeModal
                isOpen={true}
                totalLabel={`Total: $${paymentQuote.total.toFixed(2)}`}
                isSubmitting={isSubmitting}
                onConfirm={(choice) => {
                  if (choice === 'CREDIT_SUCCESS') void handleDemoPayment('CREDIT_SUCCESS');
                  if (choice === 'CASH_SUCCESS') void handleDemoPayment('CASH_SUCCESS');
                  if (choice === 'CREDIT_DECLINE') void handleDemoPayment('CREDIT_DECLINE', 'Card declined');
                }}
              />
            )}
        </div>
      )}
      <AgreementArtifactsModal
        isOpen={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        sessionIdLabel={currentSessionIdRef.current || null}
        documentsError={documentsError}
        documentsLoading={documentsLoading}
        documentsForSession={documentsForSession}
        onRefresh={() => {
          const sid = currentSessionIdRef.current;
          if (!sid) return;
          void fetchDocumentsBySession(sid);
        }}
        onDownloadPdf={(docId) => {
          void downloadAgreementPdf(docId).catch((e) => {
            setDocumentsError(e instanceof Error ? e.message : 'Failed to download PDF');
          });
        }}
      />
    </RegisterSignIn>
  );
}

