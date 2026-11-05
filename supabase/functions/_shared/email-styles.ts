/**
 * Estilos compartidos para todos los templates de email de Autopilot.
 * Dark theme coherente con la app: negro puro, amarillo de marca, tipografía Inter/system.
 *
 * Paleta:
 *   --background: #0B0A0A  (systemBackground dark)
 *   --card:       #151414  (bg-card)
 *   --primary:    #E8BB73  (dorado de la app, hsl(41 61% 61%))
 *   --foreground: #F7F5F3
 *   --muted-fg:   #B1AEA9  (muted-foreground)
 *   --border:     #282625  (separador)
 */

export const email = {
  main: {
    backgroundColor: '#0B0A0A',
    padding: '24px 12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased' as const,
  },

  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '0',
    backgroundColor: '#0B0A0A',
    borderRadius: '28px',
    overflow: 'hidden' as const,
  },

  /** Cabecera sobria con la firma de marca. */
  header: {
    backgroundColor: '#0B0A0A',
    padding: '36px 32px 0',
  },

  logoImg: {
    borderRadius: '50%',
    display: 'block' as const,
    margin: '0 0 14px',
  },

  logo: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '20px',
    fontWeight: 700 as const,
    color: '#E8BB73',
    letterSpacing: '-0.02em',
    margin: '0 0 24px',
    display: 'block' as const,
  },

  /** Cuerpo principal */
  body: {
    backgroundColor: '#0B0A0A',
    padding: '32px 32px 0',
  },

  h1: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: '#F7F5F3',
    letterSpacing: '0',
    lineHeight: '1.25',
    margin: '0 0 16px',
  },

  h2: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
    fontSize: '17px',
    fontWeight: 600 as const,
    color: '#F7F5F3',
    letterSpacing: '0',
    lineHeight: '1.4',
    margin: '0 0 12px',
  },

  text: {
    fontSize: '15px',
    color: '#E3E1DD',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  textMuted: {
    fontSize: '15px',
    color: '#B1AEA9',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  small: {
    fontSize: '13px',
    color: '#B1AEA9',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },

  /** Botón CTA principal — amarillo de marca */
  button: {
    backgroundColor: '#E8BB73',
    color: '#0B0A0A',
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
    backgroundColor: '#151414',
    borderRadius: '22px',
    padding: '20px 24px',
    margin: '0 0 24px',
  },

  /** Separador sutil */
  hr: {
    borderColor: '#282625',
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
    color: '#E8BB73',
    letterSpacing: '0',
    backgroundColor: '#151414',
    padding: '16px 12px',
    borderRadius: '999px',
    display: 'inline-block' as const,
    border: 'none',
    margin: '0 0 24px',
  },

  link: {
    color: '#E8BB73',
    textDecoration: 'underline' as const,
    wordBreak: 'break-all' as const,
  },

  linkMuted: {
    color: '#B1AEA9',
    textDecoration: 'underline' as const,
  },

  /** Footer de cierre */
  footer: {
    backgroundColor: '#0B0A0A',
    padding: '24px 32px 40px',
  },

  footerText: {
    fontSize: '13px',
    color: '#B1AEA9',
    lineHeight: '1.6',
    margin: '0',
  },
}
