/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña en Autopilot</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Restablece tu contraseña</Heading>
          <Text style={s.text}>
            Hemos recibido una solicitud para restablecer la contraseña de tu
            cuenta. Pulsa el botón para elegir una nueva.
          </Text>
          <Section style={s.buttonContainer}>
            <Button style={s.button} href={confirmationUrl}>
              Restablecer contraseña
            </Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Si no solicitaste este cambio, puedes ignorar este email. Tu
            contraseña actual seguirá funcionando.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
