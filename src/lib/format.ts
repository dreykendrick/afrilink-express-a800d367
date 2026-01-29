// Currency and phone formatting utilities

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceShort(amount: number): string {
  return `TZS ${amount.toLocaleString('en-TZ')}`;
}

// Normalize Tanzania phone number to 255XXXXXXXXX format
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.startsWith('0')) {
    digits = '255' + digits.slice(1);
  } else if (digits.startsWith('255')) {
    // Already in correct format
  } else if (digits.length === 9) {
    digits = '255' + digits;
  }
  
  return digits;
}

// Validate Tanzania phone number
export function isValidTanzaniaPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Tanzania numbers: 255 followed by 9 digits (total 12 digits)
  return /^255[67]\d{8}$/.test(normalized);
}

// Format phone for display
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 12) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  return phone;
}

// Generate unique session ID
export function getSessionId(): string {
  let sessionId = sessionStorage.getItem('afrilink_session');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('afrilink_session', sessionId);
  }
  return sessionId;
}

// Generate idempotency key for orders
export function generateIdempotencyKey(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Format date for display
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

// Format relative time
export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
