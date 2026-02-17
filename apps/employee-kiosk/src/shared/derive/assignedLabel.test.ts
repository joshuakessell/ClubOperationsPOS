import { describe, it, expect } from 'vitest';
import { deriveAssignedLabel } from './assignedLabel';

describe('deriveAssignedLabel', () => {
  it('returns "Room" when assigned resource is room', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: 'room',
        proposedRentalType: null,
        customerSelectedType: null,
      })
    ).toBe('Room');
  });

  it('returns "Locker" when assigned resource is locker', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: 'locker',
        proposedRentalType: null,
        customerSelectedType: null,
      })
    ).toBe('Locker');
  });

  it('returns "Locker" for LOCKER rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: 'LOCKER',
        customerSelectedType: null,
      })
    ).toBe('Locker');
  });

  it('returns "Locker" for GYM_LOCKER rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: null,
        customerSelectedType: 'GYM_LOCKER',
      })
    ).toBe('Locker');
  });

  it('returns "Room" for STANDARD rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: 'STANDARD',
        customerSelectedType: null,
      })
    ).toBe('Room');
  });

  it('returns "Room" for DOUBLE rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: 'DOUBLE',
        customerSelectedType: null,
      })
    ).toBe('Room');
  });

  it('returns "Room" for SPECIAL rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: null,
        customerSelectedType: 'SPECIAL',
      })
    ).toBe('Room');
  });

  it('prefers proposedRentalType over customerSelectedType', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: 'LOCKER',
        customerSelectedType: 'STANDARD',
      })
    ).toBe('Locker');
  });

  it('returns "Resource" as default fallback', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: null,
        customerSelectedType: null,
      })
    ).toBe('Resource');
  });

  it('returns "Resource" for unknown rental type', () => {
    expect(
      deriveAssignedLabel({
        assignedResourceType: null,
        proposedRentalType: 'UNKNOWN_TYPE',
        customerSelectedType: null,
      })
    ).toBe('Resource');
  });
});
