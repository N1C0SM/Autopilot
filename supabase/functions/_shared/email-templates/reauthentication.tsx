/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Tu código de verificación de Autopilot</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirma tu identidad</Heading>
        <Text style={text}>Usa este código para confirmar tu identidad en Autopilot:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código caduca en breve. Si no fuiste tú, ignora este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: '#0b0b0b',
  margin: '0 0 20px',
  fontFamily: 'Space Grotesk, Inter, Arial, sans-serif',
}
const text = {
  fontSize: '15px',
  color: '#3a3a3a',
  lineHeight: '1.6',
  margin: '0 0 25px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  color: '#0b0b0b',
  letterSpacing: '4px',
  background: '#FFF7CC',
  padding: '14px 20px',
  borderRadius: '10px',
  display: 'inline-block',
  margin: '0 0 30px',
}
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }
