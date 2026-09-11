// Default accounts from the build brief. Editable in Settings (Phase 2).

function account(id, name, bank, kind, extra = {}) {
  return {
    id,
    name,
    bank,
    kind,
    last4: null,
    openingBalance: 0,
    openingDate: null,
    color: 'var(--color-navy)',
    ...extra
  }
}

export const DEFAULT_ACCOUNTS = [
  account('mashreq-debit-9437', 'Mashreq Debit 9437', 'Mashreq', 'debit', { last4: '9437', color: 'var(--color-navy)' }),
  account('mashreq-credit-8777', 'Mashreq Credit 8777', 'Mashreq', 'credit', { last4: '8777', color: 'var(--color-terracotta)' }),
  account('mashreq-transfer', 'Mashreq Transfer', 'Mashreq', 'debit', { color: 'var(--color-navy)' }),
  account('rak-bank', 'RAK Bank', 'RAK Bank', 'business', { color: 'var(--color-teal)', defaultLedger: 'lh_business' }),
  account('stripe', 'Stripe', 'Stripe', 'gateway', { color: 'var(--color-violet)' }),
  account('cash', 'Cash', null, 'cash', { color: 'var(--color-amber)' })
]
