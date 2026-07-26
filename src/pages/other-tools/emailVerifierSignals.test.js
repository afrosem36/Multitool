import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRefreshActivity,
  getEngagementSignal,
  isDeliveryVerification,
} from './emailVerifierSignals.js';

test('Instant Check stays neutral when its response includes a verificationId', () => {
  const instantResult = {
    verificationId: 'verification_instant_fixture',
    deliveryStatus: 'not_sent',
    confirmationStatus: 'not_requested',
    engagementStatus: null,
  };

  assert.equal(isDeliveryVerification(instantResult), false);
  assert.equal(canRefreshActivity(instantResult), false);
  assert.equal(getEngagementSignal(instantResult).label, 'Not checked');
});

test('Confirm by Email preserves detected open telemetry and refresh eligibility', () => {
  const deliveryResult = {
    verificationId: 'verification_delivery_fixture',
    deliveryStatus: 'delivered',
    confirmationStatus: 'not_confirmed',
    engagementStatus: 'open_detected',
    lastOpenedAt: '2026-07-26T05:15:00.000Z',
    openCount: 2,
  };

  assert.equal(isDeliveryVerification(deliveryResult), true);
  assert.equal(canRefreshActivity(deliveryResult), true);
  assert.deepEqual(getEngagementSignal(deliveryResult), {
    label: 'Opened',
    timestamp: '2026-07-26T05:15:00.000Z',
    count: 2,
    countLabel: 'opens',
    tone: 'success',
  });
});

test('Confirm by Email without an event uses an honest neutral absence label', () => {
  const sentResult = {
    verificationId: 'verification_sent_fixture',
    deliveryStatus: 'sent',
    confirmationStatus: 'not_confirmed',
    engagementStatus: 'no_open_detected',
  };

  assert.equal(canRefreshActivity(sentResult), true);
  assert.equal(getEngagementSignal(sentResult).label, 'No open detected');
  assert.equal(getEngagementSignal(sentResult).tone, 'neutral');
});
