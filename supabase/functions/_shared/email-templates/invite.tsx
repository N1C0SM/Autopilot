/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Te han invitado a Autopilot</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.logo}>● Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Te han invitado a Autopilot</Heading>
          <Text style={s.text}>
            Has recibido una invitación para unirte a{' '}
            <Link href={siteUrl} style={s.link}>autopilotplan.com</Link>.
            Pulsa el botón para aceptarla y crear tu cuenta.
          </Text>
          <Section style={s.buttonContainer}>
            <Button style={s.button} href={confirmationUrl}>
              Aceptar invitación
            </Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Si no esperabas esta invitación, puedes ignorar este email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
