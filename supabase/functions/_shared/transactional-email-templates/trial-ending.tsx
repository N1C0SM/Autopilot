/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface TrialEndingProps {
  name?: string
  daysLeft?: number
  manageUrl?: string
}

const TrialEndingEmail = ({
  name,
  daysLeft = 2,
  manageUrl = 'https://autopilotplan.com/dashboard?section=settings',
}: TrialEndingProps) => {
  const isLastDay = daysLeft <= 1
  const headline = isLastDay
    ? 'Tu prueba gratuita termina mañana'
    : `Tu prueba gratuita termina en ${daysLeft} días`
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{headline} · Sigue con Autopilot por 19€/mes</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {name ? `Hola ${name},` : 'Hola,'}
          </Heading>
          <Text style={text}>
            {headline}. A partir de ese día se activará tu suscripción de{' '}
            <strong>19€/mes</strong> y seguirás recibiendo tu plan adaptado cada semana.
          </Text>
          <Text style={text}>
            Si quieres seguir, no tienes que hacer nada: la renovación es automática.
          </Text>
          <Hr style={hr} />
          <Heading as="h2" style={h2}>¿Necesitas pausar o cancelar?</Heading>
          <Text style={text}>
            Puedes gestionar tu suscripción (pausar, cambiar plan o cancelar) en un clic
            desde tu panel. Cancelar antes de mañana no genera ningún cobro.
          </Text>
          <Section style={buttonContainer}>
            <Button href={manageUrl} style={button}>
              Gestionar mi suscripción
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={small}>
            ¿Dudas sobre tu plan o resultados? Responde a este correo o escríbenos por el
            chat dentro de la app — te responde un entrenador real.
          </Text>
          <Text style={footer}>— El equipo de {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialEndingEmail,
  subject: (data: Record<string, any>) =>
    (data?.daysLeft ?? 2) <= 1
      ? 'Tu prueba gratuita termina mañana ⏰'
      : `Tu prueba gratuita termina en ${data?.daysLeft ?? 2} días`,
  displayName: 'Recordatorio fin de prueba',
  previewData: {
    name: 'Juan',
    daysLeft: 2,
    manageUrl: 'https://autopilotplan.com/dashboard?section=settings',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#0b0b0b',
  margin: '0 0 20px',
  fontFamily: 'Space Grotesk, Inter, Arial, sans-serif',
}
const h2 = {
  fontSize: '17px',
  fontWeight: 700,
  color: '#0b0b0b',
  margin: '0 0 12px',
  fontFamily: 'Space Grotesk, Inter, Arial, sans-serif',
}
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '13px', color: '#666666', lineHeight: '1.6', margin: '0 0 16px' }
const buttonContainer = { margin: '24px 0', textAlign: 'center' as const }
const button = {
  backgroundColor: '#FFCC00',
  color: '#000000',
  fontSize: '15px',
  fontWeight: 700,
  padding: '14px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#888888', margin: '24px 0 0' }