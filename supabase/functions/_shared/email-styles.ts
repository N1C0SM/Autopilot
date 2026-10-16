/**
 * Estilos compartidos para todos los templates de email de Autopilot.
 * Dark theme coherente con la app: negro puro, dorado de marca, tipografía Inter/system.
 *
 * Paleta:
 *   --background: #000000  (systemBackground dark)
 *   --card:       #1C1C1E  (secondarySystemGroupedBackground)
 *   --primary:    #C9A44A  (dorado marca, hsl(43 61% 60%))
 *   --foreground: #FFFFFF
 *   --muted-fg:   #98989E  (secondaryLabel iOS)
 *   --border:     #38383A  (opaque separator)
 */

export const email = {
  main: {
    backgroundColor: '#000000',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased' as const,
  },

  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '0',
  },

  /** Cabecera con logotipo y línea dorada */
  header: {
    backgroundColor: '#000000',
    padding: '40px 32px 0',
    borderBottom: '1px solid #38383A',
  },

  logo: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '20px',
    fontWeight: 700 as const,
    color: '#C9A44A',
    letterSpacing: '-0.02em',
    margin: '0 0 24px',
    display: 'block' as const,
  },

  /** Cuerpo principal */
  body: {
    backgroundColor: '#000000',
    padding: '32px 32px 0',
  },

  h1: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
    lineHeight: '1.25',
    margin: '0 0 16px',
  },

  h2: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '17px',
    fontWeight: 600 as const,
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
    lineHeight: '1.4',
    margin: '0 0 12px',
  },

  text: {
    fontSize: '15px',
    color: '#EBEBF5CC', // ~85% white, equivale a label iOS dark
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  textMuted: {
    fontSize: '15px',
    color: '#98989E', // secondaryLabel iOS dark
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  small: {
    fontSize: '13px',
    color: '#98989E',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },

  /** Botón CTA principal — dorado de marca */
  button: {
    backgroundColor: '#C9A44A',
    color: '#000000',
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '12px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block' as const,
    letterSpacing: '-0.01em',
  },

  buttonContainer: {
    margin: '28px 0',
    textAlign: 'left' as const,
  },

  /** Card oscura para destacar info (código OTP, stats, etc.) */
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: '16px',
    padding: '20px 24px',
    margin: '0 0 24px',
    border: '1px solid #38383A',
  },

  /** Separador sutil */
  hr: {
    borderColor: '#38383A',
    borderTopWidth: '1px',
    borderStyle: 'solid' as const,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    margin: '28px 0',
  },

  /** Código OTP / token */
  code: {
    fontFamily: '"SF Mono", "Fira Code", "Courier New", Courier, monospace',
    fontSize: '32px',
    fontWeight: 700 as const,
    color: '#C9A44A',
    letterSpacing: '6px',
    backgroundColor: '#1C1C1E',
    padding: '16px 24px',
    borderRadius: '12px',
    display: 'inline-block' as const,
    border: '1px solid #38383A',
    margin: '0 0 24px',
  },

  link: {
    color: '#C9A44A',
    textDecoration: 'underline' as const,
    wordBreak: 'break-all' as const,
  },

  linkMuted: {
    color: '#98989E',
    textDecoration: 'underline' as const,
  },

  /** Footer de cierre */
  footer: {
    backgroundColor: '#000000',
    padding: '24px 32px 40px',
    borderTop: '1px solid #38383A',
  },

  footerText: {
    fontSize: '13px',
    color: '#636366', // tertiaryLabel iOS dark
    lineHeight: '1.6',
    margin: '0',
  },
}
