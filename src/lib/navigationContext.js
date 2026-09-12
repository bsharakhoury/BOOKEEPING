import { createContext, useContext } from 'react'

// Lets a screen navigate to another screen (e.g. Business's "quick access to Invoices and VAT").
export const NavigationContext = createContext(() => {})

export function useNavigate() {
  return useContext(NavigationContext)
}
