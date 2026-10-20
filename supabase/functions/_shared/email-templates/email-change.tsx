/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma el cambio de email en Autopilot</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Confirma el cambio de email</Heading>
          <Text style={s.text}>
            Has solicitado cambiar tu email de{' '}
            <Link href={`mailto:${oldEmail}`} style={s.link}>{oldEmail}</Link>{' '}
            a{' '}
            <Link href={`mailto:${newEmail}`} style={s.link}>{newEmail}</Link>.
          </Text>
          <Text style={s.text}>Pulsa el botón para confirmar el cambio:</Text>
          <Section style={s.buttonContainer}>
            <Button style={s.button} href={confirmationUrl}>
              Confirmar cambio de email
            </Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Si no solicitaste este cambio, asegura tu cuenta inmediatamente.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
