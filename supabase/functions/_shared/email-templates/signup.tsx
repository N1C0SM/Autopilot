/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ confirmationUrl }: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma tu email para activar tu cuenta en Autopilot</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.logo}>● Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Bienvenido a Autopilot</Heading>
          <Text style={s.text}>
            Confirma tu email para activar tu cuenta y empezar a recibir tu plan
            de entrenamiento y nutrición personalizado.
          </Text>
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
