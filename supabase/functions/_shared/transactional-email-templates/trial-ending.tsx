/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

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
      <Preview>{headline} · Sigue con Autopilot desde 29€/mes</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>
              {name ? `${name}, ` : ''}{headline}.
            </Heading>
            <Text style={s.text}>
              A partir de ese día se activará tu suscripción de{' '}
              <strong style={{ color: '#C9A44A' }}>29€/mes</strong>{' '}
              y seguirás recibiendo tu plan adaptado cada semana.
              Si quieres seguir, no tienes que hacer nada.
            </Text>
            <Hr style={s.hr} />
            <Heading as="h2" style={s.h2}>¿Necesitas pausar o cancelar?</Heading>
            <Text style={s.text}>
              Puedes gestionar tu suscripción en un clic desde tu panel.
              Cancelar antes de mañana no genera ningún cobro.
            </Text>
            <Section style={s.buttonContainer}>
              <Button href={manageUrl} style={s.button}>
                Gestionar mi suscripción
              </Button>
            </Section>
            <Hr style={s.hr} />
            <Text style={s.small}>
              ¿Dudas sobre tu plan o resultados? Responde a este correo o escríbenos
              por el chat — te responde un entrenador real.
            </Text>
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>— El equipo de Autopilot</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialEndingEmail,
  subject: (data: Record<string, unknown>) =>
    Number(data?.daysLeft ?? 2) <= 1
      ? 'Tu prueba gratuita termina mañana'
      : `Tu prueba gratuita termina en ${data?.daysLeft ?? 2} días`,
  displayName: 'Recordatorio fin de prueba',
  previewData: {
    name: 'Juan',
    daysLeft: 2,
    manageUrl: 'https://autopilotplan.com/dashboard?section=settings',
  },
} satisfies TemplateEntry
