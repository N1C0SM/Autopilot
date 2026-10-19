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

const codeStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '34px',
  fontWeight: 700 as const,
  letterSpacing: '0.28em',
  color: '#FFAA3C',
  backgroundColor: '#111216',
  border: '1px solid #1f2024',
  borderRadius: '16px',
  padding: '18px 0',
  textAlign: 'center' as const,
  margin: '0 0 20px',
  display: 'block' as const,
}

export const SignupEmail = ({ confirmationUrl, token }: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{token ? 'Tu código de verificación de Autopilot' : 'Confirma tu email para activar tu cuenta en Autopilot'}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Bienvenido a Autopilot</Heading>
          <Text style={s.text}>
            Confirma tu email para activar tu cuenta y empezar a recibir tu plan
            de entrenamiento y nutrición personalizado.
          </Text>

          {token ? (
            <>
              <Text style={{ ...s.text, marginBottom: '10px' }}>
                Introduce este código en la app:
              </Text>
              <Text style={codeStyle}>{token}</Text>
              <Text style={s.textMuted}>
                Caduca a los pocos minutos. Si caduca, pide uno nuevo desde la
                pantalla de verificación.
              </Text>
            </>
          ) : null}

          <Section style={s.buttonContainer}>
            <Button style={s.button} href={confirmationUrl}>
              Confirmar email
            </Button>
          </Section>
          <Text style={s.textMuted}>
            O copia y pega este enlace en tu navegador:<br />
            <Link href={confirmationUrl} style={s.link}>{confirmationUrl}</Link>
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Si no creaste una cuenta en Autopilot, puedes ignorar este email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
