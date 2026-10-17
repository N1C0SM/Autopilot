/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface PaymentReminderProps {
  name?: string
  customMessage?: string
  checkoutUrl?: string
}

const PaymentReminderEmail = ({
  name,
  customMessage,
  checkoutUrl = 'https://autopilotplan.com/dashboard',
}: PaymentReminderProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu plan personalizado de Autopilot te está esperando</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.logo}>● Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>
            {name ? `Hola, ${name}.` : 'Hola.'}
          </Heading>
          <Text style={s.text}>
            {customMessage ||
              'Te registraste en Autopilot pero todavía no has activado tu plan. Tu entrenamiento + nutrición personalizados están listos para empezar.'}
          </Text>
          <Text style={s.text}>
            Empieza hoy y recibe tu plan completo en Google Calendar mañana mismo.
          </Text>
          <Section style={s.buttonContainer}>
            <Button href={checkoutUrl} style={s.button}>
              Activar mi plan
            </Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>— El equipo de Autopilot</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentReminderEmail,
  subject: 'Tu plan personalizado te está esperando',
  displayName: 'Recordatorio de pago',
  previewData: {
    name: 'Juan',
    customMessage: '',
    checkoutUrl: 'https://autopilotplan.com/dashboard',
  },
} satisfies TemplateEntry
