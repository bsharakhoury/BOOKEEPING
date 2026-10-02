// How the account owner's own name appears on bank statements, so a transfer *to or from the owner*
// (a dividend, an owner draw) can be told apart from a payment to a supplier. Kept out of the
// parsers so there is exactly one place to change.
export const OWNER_NAME_RE = /BECHARA\s+EL\s+KHOURY/i
