/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface MiniPlanProps {
  insight?: string
  mistake?: string
  action?: string
  ctaUrl?: string
}

const MiniPlanEmail = ({
  insight = 'Tu mayor bloqueo no es la rutina, es la constancia.',
  mistake = 'Estás cambiando de plan cada 2 semanas.',
  action = 'Esta semana fija 3 entrenos en tu calendario y mide solo eso.',
  ctaUrl = 'https://autopilotplan.com/quiz',
}: MiniPlanProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu mini-plan personalizado de {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tu mini-plan está listo</Heading>
        <Text style={text}>
          Hemos cruzado tus respuestas con lo que vemos a diario en {SITE_NAME}.
          Aquí tienes lo que más te puede ayudar hoy:
        </Text>

        <Section style={card}>
          <Text style={cardTitle}>Insight clave</Text>
          <Text style={cardBody}>{insight}</Text>
        </Section>

        <Section style={card}>
          <Text style={cardTitle}>El error que estás cometiendo</Text>
          <Text style={cardBody}>{mistake}</Text>
        </Section>

        <Section style={cardAccent}>
          <Text style={cardTitleAccent}>Acción concreta para hoy</Text>
          <Text style={cardBody}>{action}</Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '32px 0 8px' }}>
          <Button href={ctaUrl} style={button}>
            Quiero el plan completo (7 días gratis)
          </Button>
        </Section>

        <Text style={footer}>
          Sin tarjeta para empezar · Cancela cuando quieras<br />
          — El equipo de {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MiniPlanEmail,
  subject: 'Tu mini-plan personalizado',
  displayName: 'Mini-plan (lead magnet)',
  previewData: {
    insight: 'Tu mayor bloqueo es la constancia, no el plan.',
    mistake: 'Estás haciendo demasiado cardio para tu objetivo.',
    action: 'Sube proteína a 1.6 g/kg y mide solo eso esta semana.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const card = {
  background: '#f7f7f8',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '0 0 12px',
}
const cardAccent = {
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '0 0 12px',
}
const cardTitle = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#6b7280',
  margin: '0 0 6px',
  fontWeight: 600,
}
const cardTitleAccent = { ...cardTitle, color: '#4f46e5' }
const cardBody = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.5', margin: 0 }
const button = {
  backgroundColor: '#0a0a0a',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 22px',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const }