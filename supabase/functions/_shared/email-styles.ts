/**
 * Estilos compartidos para todos los templates de email de Autopilot.
 * Dark theme coherente con la app: negro puro, amarillo de marca, tipografía Inter/system.
 *
 * Paleta:
 *   --background: #000000  (systemBackground dark)
 *   --card:       #111216  (secondarySystemGroupedBackground)
 *   --primary:    #D6B45B  (dorado de la app, hsl(43 61% 60%))
 *   --foreground: #FFFFFF
 *   --muted-fg:   #98989E  (secondaryLabel iOS)
 *   --border:     #1f2024  (opaque separator)
 */

export const email = {
  main: {
    backgroundColor: '#000000',
    padding: '24px 12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased' as const,
  },

  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '0',
    backgroundColor: '#08090b',
    borderRadius: '28px',
    border: '1px solid #1f2024',
    overflow: 'hidden' as const,
  },

  /** Cabecera con logotipo y línea dorada */
  header: {
    backgroundColor: '#08090b',
    padding: '36px 32px 0',
    borderTop: '2px solid #D6B45B',
    borderBottom: '1px solid #1f2024',
  },

  logoImg: {
    borderRadius: '50%',
    display: 'block' as const,
    margin: '0 0 14px',
  },

  logo: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '13px',
    fontWeight: 700 as const,
    color: '#FFFFFF',
    letterSpacing: '0.42em',
    textTransform: 'uppercase' as const,
    margin: '0 0 24px',
    display: 'block' as const,
  },

  /** Cuerpo principal */
  body: {
    backgroundColor: '#08090b',
    padding: '32px 32px 0',
  },

  h1: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: '#FFFFFF',
    letterSpacing: '0',
    lineHeight: '1.25',
    margin: '0 0 16px',
  },

  h2: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '17px',
    fontWeight: 600 as const,
    color: '#FFFFFF',
    letterSpacing: '0',
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

  /** Botón CTA principal — amarillo de marca */
  button: {
    backgroundColor: '#D6B45B',
    color: '#000000',
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '999px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block' as const,
    letterSpacing: '0',
  },

  buttonContainer: {
    margin: '28px 0',
    textAlign: 'left' as const,
  },

  /** Card oscura para destacar info (código OTP, stats, etc.) */
  card: {
    backgroundColor: '#111216',
    borderRadius: '22px',
    padding: '20px 24px',
    margin: '0 0 24px',
    border: '1px solid #1f2024',
  },

  /** Separador sutil */
  hr: {
    borderColor: '#1f2024',
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
    color: '#D6B45B',
    letterSpacing: '0',
    backgroundColor: '#111216',
    padding: '16px 12px',
    borderRadius: '12px',
    display: 'inline-block' as const,
    border: '1px solid #1f2024',
    margin: '0 0 24px',
  },

  link: {
    color: '#D6B45B',
    textDecoration: 'underline' as const,
    wordBreak: 'break-all' as const,
  },

  linkMuted: {
    color: '#98989E',
    textDecoration: 'underline' as const,
  },

  /** Footer de cierre */
  footer: {
    backgroundColor: '#08090b',
    padding: '24px 32px 40px',
    borderTop: '1px solid #1f2024',
  },

  footerText: {
    fontSize: '13px',
    color: '#636366', // tertiaryLabel iOS dark
    lineHeight: '1.6',
    margin: '0',
  },
}
