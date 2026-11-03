/**
 * Estilos compartidos para todos los templates de email de Autopilot.
 * Dark theme coherente con la app: negro puro, amarillo de marca, tipografía Inter/system.
 *
 * Paleta:
 *   --background: #000000  (systemBackground dark)
 *   --card:       #141416  (bg-card)
 *   --primary:    #D8B25E  (dorado de la app, hsl(41 61% 61%))
 *   --foreground: #FFFFFF
 *   --muted-fg:   #A8A8AE  (muted-foreground)
 *   --border:     #262629  (separador)
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
    backgroundColor: '#000000',
    borderRadius: '28px',
    overflow: 'hidden' as const,
  },

  /** Cabecera sobria con la firma de marca. */
  header: {
    backgroundColor: '#000000',
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
    color: '#D8B25E',
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
    color: '#E4E4E7',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  textMuted: {
    fontSize: '15px',
    color: '#A8A8AE',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },

  small: {
    fontSize: '13px',
    color: '#A8A8AE',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },

  /** Botón CTA principal — amarillo de marca */
  button: {
    backgroundColor: '#D8B25E',
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
    backgroundColor: '#141416',
    borderRadius: '22px',
    padding: '20px 24px',
    margin: '0 0 24px',
  },

  /** Separador sutil */
  hr: {
    borderColor: '#262629',
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
    color: '#D8B25E',
    letterSpacing: '0',
    backgroundColor: '#141416',
    padding: '16px 12px',
    borderRadius: '999px',
    display: 'inline-block' as const,
    border: 'none',
    margin: '0 0 24px',
  },

  link: {
    color: '#D8B25E',
    textDecoration: 'underline' as const,
    wordBreak: 'break-all' as const,
  },

  linkMuted: {
    color: '#A8A8AE',
    textDecoration: 'underline' as const,
  },

  /** Footer de cierre */
  footer: {
    backgroundColor: '#000000',
    padding: '24px 32px 40px',
  },

  footerText: {
    fontSize: '13px',
    color: '#A8A8AE',
    lineHeight: '1.6',
    margin: '0',
  },
}
