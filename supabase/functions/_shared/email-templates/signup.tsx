/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirma tu email en Autopilot</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bienvenido a Autopilot</Heading>
        <Text style={text}>
          Confirma tu email para activar tu cuenta y empezar a recibir tu plan
          de entrenamiento y nutrición personalizado.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar email
        </Button>
        <Text style={text}>
          O copia y pega este enlace en tu navegador:<br />
          <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
        </Text>
        <Text style={footer}>
          Si no creaste una cuenta en Autopilot, puedes ignorar este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#0b0b0b', textDecoration: 'underline', wordBreak: 'break-all' as const }
const button = {
  backgroundColor: '#FFCC00',
  color: '#000000',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }
