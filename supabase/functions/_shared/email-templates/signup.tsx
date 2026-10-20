/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

const codeBox = {
  backgroundColor: '#111216',
  border: s.card.border,
  borderRadius: '20px',
  padding: '24px 16px 20px',
  margin: '4px 0 28px',
  textAlign: 'center' as const,
}

const codeLabel = {
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: '#98989E',
  margin: '0 0 10px',
}

const codeDigits = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '28px',
  lineHeight: '1.1',
  fontWeight: 700 as const,
  letterSpacing: '0',
  color: s.code.color,
  whiteSpace: 'nowrap' as const,
  margin: '0',
  display: 'block' as const,
}

const codeMeta = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#98989E',
  margin: '12px 0 0',
}

const divider = {
  borderTop: '1px solid #1f2024',
  margin: '4px 0 24px',
}

const noticeBox = {
  backgroundColor: '#111216',
  border: '1px solid #1f2024',
  borderRadius: '16px',
  padding: '16px 18px',
  margin: '28px 0 0',
}

const noticeText = {
  fontSize: '13px',
  lineHeight: '1.6',
  color: '#98989E',
  margin: '0',
}

const headerTagline = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#98989E',
  margin: '0 0 24px',
  letterSpacing: '0.01em',
}

const fallbackUrl = {
  fontSize: '12px',
  lineHeight: '1.6',
  color: '#98989E',
  margin: '0 0 20px',
  wordBreak: 'break-all' as const,
}

export const SignupEmail = ({ confirmationUrl, token }: SignupEmailProps) => {
  // El servicio entrega el OTP completo en `token`; si algún día llegara un
  // hash largo, no lo pintamos como si fuera un código.
  const otp = typeof token === 'string' && /^\d{4,10}$/.test(token.trim()) ? token.trim() : ''
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>
        {otp ? `${otp} es tu código de verificación de Autopilot` : 'Confirma tu cuenta de Autopilot'}
      </Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
            <Text style={s.logo}>Autopilot</Text>
            <Text style={headerTagline}>Entrenamiento y nutrición personalizados</Text>
          </Section>

          <Section style={s.body}>
            <Heading style={s.h1}>Confirma tu cuenta</Heading>
            <Text style={s.text}>
              Ya casi está. {otp ? 'Introduce este código en la app para activar' : 'Pulsa el botón para activar'} tu
              cuenta de Autopilot y empezar con tu plan.
            </Text>

            {otp ? (
              <Section style={codeBox}>
                <Text style={codeLabel}>Código de verificación</Text>
                <Text style={codeDigits}>{otp.length === 8 ? `${otp.slice(0, 4)} ${otp.slice(4)}` : otp}</Text>
                <Text style={codeMeta}>Caduca a los pocos minutos · Un solo uso</Text>
              </Section>
            ) : null}

            <Section style={divider} />
            <Text style={s.textMuted}>
              {otp ? 'También puedes confirmar tu cuenta desde el navegador:' : 'Confirma tu cuenta desde el navegador:'}
            </Text>
            <Section style={s.buttonContainer}>
              <Button style={s.button} href={confirmationUrl}>
                Confirmar cuenta
              </Button>
            </Section>

            <Text style={s.small}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
            <Text style={fallbackUrl}>
              <Link href={confirmationUrl} style={s.link}>{confirmationUrl}</Link>
            </Text>

            <Section style={noticeBox}>
              <Text style={noticeText}>
                Por seguridad, no compartas este código con nadie. Si no has creado una cuenta en Autopilot,
                puedes ignorar este correo y no se activará nada.
              </Text>
            </Section>
          </Section>

          <Section style={s.footer}>
            <Text style={s.footerText}>
              Autopilot · Entrenamiento y nutrición personalizados
            </Text>
            <Text style={s.footerText}>
              <Link href="https://autopilotplan.com" style={s.link}>autopilotplan.com</Link>
              {' · '}
              <Link href="https://autopilotplan.com/legal/privacidad" style={s.link}>Privacidad</Link>
              {' · '}
              <Link href="https://autopilotplan.com/legal/terminos" style={s.link}>Términos</Link>
            </Text>
            <Text style={s.footerText}>
              Has recibido este correo porque se usó esta dirección para crear una cuenta en Autopilot.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default SignupEmail
