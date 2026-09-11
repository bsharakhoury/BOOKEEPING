// Default category set from the build brief. Settings screen (Phase 2) lets the
// user rename, recolor, budget, or archive these; renames rewrite existing transactions.

function cat(id, name, ledger, group, type, extra = {}) {
  return {
    id,
    name,
    ledger,
    group,
    type,
    stream: null,
    color: 'var(--color-navy)',
    budget: null,
    isCustom: false,
    archived: false,
    ...extra
  }
}

export const DEFAULT_CATEGORIES = [
  // Personal expense
  cat('food-groceries', 'Food (Groceries)', 'personal', 'Food', 'expense', { color: 'var(--color-sage)' }),
  cat('food-eating-out', 'Food (Eating Out)', 'personal', 'Food', 'expense', { color: 'var(--color-sage)' }),
  cat('transport-public-taxi', 'Transport (Public/Taxi)', 'personal', 'Transport', 'expense', { color: 'var(--color-teal)' }),
  cat('transport-fuel', 'Transport (Fuel)', 'personal', 'Transport', 'expense', { color: 'var(--color-teal)' }),
  cat('transport-car-rental', 'Transport (Car Rental)', 'personal', 'Transport', 'expense', { color: 'var(--color-teal)' }),
  cat('utilities', 'Utilities', 'personal', 'Home', 'expense'),
  cat('personal-utilities', 'Personal utilities', 'personal', 'Home', 'expense'),
  cat('personal-subscription', 'Personal subscription', 'personal', 'Subscriptions', 'expense', { color: 'var(--color-violet)' }),
  cat('personal-care', 'Personal care', 'personal', 'Personal', 'expense'),
  cat('personal-expenses', 'Personal expenses', 'personal', 'Personal', 'expense'),
  cat('mental-therapy', 'Mental / Therapy', 'personal', 'Health', 'expense', { color: 'var(--color-terracotta)' }),
  cat('socializing', 'Socializing', 'personal', 'Social', 'expense', { color: 'var(--color-amber)' }),
  cat('home', 'Home', 'personal', 'Home', 'expense'),
  cat('rent', 'Rent', 'personal', 'Home', 'expense'),
  cat('debt-payment', 'Debt payment', 'personal', 'Debt', 'expense', { color: 'var(--color-terracotta)' }),
  cat('cash-withdrawal', 'Cash Withdrawal', 'personal', 'Cash', 'expense'),

  // Business (Mashreq) expense
  cat('business-subscription', 'Business subscription', 'business', 'Business', 'expense', { color: 'var(--color-violet)' }),
  cat('business-expenses', 'Business expenses', 'business', 'Business', 'expense'),
  cat('office-workspace', 'Office / Workspace', 'business', 'Business', 'expense'),
  cat('software-tools', 'Software / Tools', 'business', 'Business', 'expense'),
  cat('marketing', 'Marketing', 'business', 'Business', 'expense', { color: 'var(--color-amber)' }),
  cat('travel-business', 'Travel (Business)', 'business', 'Business', 'expense', { color: 'var(--color-teal)' }),

  // Leaf & Hook business expense
  cat('lh-production-costs', 'LH – Production Costs', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-supplier-payment', 'LH – Supplier Payment', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-bank-fees', 'LH – Bank Fees', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-legal-accounting', 'LH – Legal / Accounting', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-travel', 'LH – Travel', 'lh_business', 'Leaf & Hook', 'expense', { color: 'var(--color-teal)' }),
  cat('lh-equipment', 'LH – Equipment', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-marketing', 'LH – Marketing', 'lh_business', 'Leaf & Hook', 'expense', { color: 'var(--color-amber)' }),
  cat('lh-vat', 'LH – VAT', 'lh_business', 'Leaf & Hook', 'expense'),
  cat('lh-other', 'LH – Other', 'lh_business', 'Leaf & Hook', 'expense'),

  // Income
  cat('salary-beno', 'Salary – Beno', 'income', 'Income', 'income', { stream: 'salary', color: 'var(--color-sage)' }),
  cat('lh-filmmaking', 'Leaf & Hook – Filmmaking', 'income', 'Income', 'income', { stream: 'lh_media', color: 'var(--color-sage)' }),
  cat('lh-music-sound', 'Leaf & Hook – Music / Sound', 'income', 'Income', 'income', { stream: 'lh_media', color: 'var(--color-sage)' }),
  cat('lh-media', 'Leaf & Hook – Media', 'income', 'Income', 'income', { stream: 'lh_media', color: 'var(--color-sage)' }),
  cat('lh-license-revenue', 'Leaf & Hook – License Revenue', 'income', 'Income', 'income', { stream: 'lh_media', color: 'var(--color-sage)' }),
  cat('lh-wellness', 'Leaf & Hook – Wellness', 'income', 'Income', 'income', { stream: 'lh_wellness', color: 'var(--color-teal)' }),
  cat('prana-harmony', 'Prana Harmony', 'income', 'Income', 'income', { stream: 'lh_wellness', color: 'var(--color-teal)' }),
  cat('freelance-film', 'Freelance Film', 'income', 'Income', 'income', { stream: 'freelance', color: 'var(--color-amber)' }),
  cat('freelance-wellness', 'Freelance Wellness', 'income', 'Income', 'income', { stream: 'freelance', color: 'var(--color-amber)' }),
  cat('freelance-other', 'Freelance Other', 'income', 'Income', 'income', { stream: 'freelance', color: 'var(--color-amber)' }),
  cat('bank-bonus', 'Bank Bonus', 'income', 'Income', 'income', { stream: 'other', color: 'var(--color-violet)' }),
  cat('transfer-in', 'Transfer In', 'income', 'Income', 'income', { stream: 'other', color: 'var(--color-violet)' }),
  cat('refund', 'Refund', 'income', 'Income', 'income', { stream: 'other', color: 'var(--color-violet)' }),
  cat('other-income', 'Other Income', 'income', 'Income', 'income', { stream: 'other', color: 'var(--color-violet)' })
]
