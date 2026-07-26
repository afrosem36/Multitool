const DELIVERY_ACTIVITY_STATUSES = new Set([
  'sent',
  'delivered',
  'delayed',
  'soft_bounce',
  'hard_bounce',
  'complaint',
  'failed',
]);

const CONFIRMATION_ACTIVITY_STATUSES = new Set([
  'not_confirmed',
  'confirmed',
  'confirmed_active',
  'expired',
]);

export function normalizeSignalStatus(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isDeliveryVerification(result = {}) {
  const deliveryStatus = normalizeSignalStatus(result.deliveryStatus);
  const confirmationStatus = normalizeSignalStatus(result.confirmationStatus);

  if (deliveryStatus === 'not_sent' || confirmationStatus === 'not_requested') {
    return false;
  }

  return Boolean(
    result.sentAt ||
      result.deliveredAt ||
      Number(result.openCount || 0) > 0 ||
      Number(result.clickCount || 0) > 0 ||
      DELIVERY_ACTIVITY_STATUSES.has(deliveryStatus) ||
      CONFIRMATION_ACTIVITY_STATUSES.has(confirmationStatus),
  );
}

export function getEngagementSignal(result = {}) {
  if (!isDeliveryVerification(result)) {
    return {
      label: 'Not checked',
      timestamp: null,
      count: 0,
      countLabel: '',
      tone: 'neutral',
    };
  }

  const status = normalizeSignalStatus(result.engagementStatus);

  if (status === 'click_detected') {
    return {
      label: 'Link clicked',
      timestamp: result.lastClickedAt || result.firstClickedAt,
      count: Number(result.clickCount || 0),
      countLabel: 'clicks',
      tone: 'success',
    };
  }

  if (status === 'open_detected') {
    return {
      label: 'Opened',
      timestamp: result.lastOpenedAt || result.firstOpenedAt,
      count: Number(result.openCount || 0),
      countLabel: 'opens',
      tone: 'success',
    };
  }

  return {
    label: 'No open detected',
    timestamp: null,
    count: 0,
    countLabel: '',
    tone: 'neutral',
  };
}

export function canRefreshActivity(result = {}) {
  return Boolean(result.verificationId && isDeliveryVerification(result));
}
