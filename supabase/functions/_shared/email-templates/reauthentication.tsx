/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación de Autopilot</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Confirma tu identidad</Heading>
          <Text style={s.text}>
            Usa este código para confirmar tu identidad en Autopilot:
          </Text>
          <Text style={s.code}>{token}</Text>
          <Text style={s.textMuted}>
            Este código caduca en breve. Si no fuiste tú, ignora este email.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Por seguridad, nunca compartas este código con nadie.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
