/**
 * Bridge page layout — bypasses the root layout so the template HTML
 * renders as a standalone full-document page.
 */
export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
