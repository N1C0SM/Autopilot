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

interface RenewalNoAnswerProps {
  name?: string
  cycleEndDate?: string
  manageUrl?: string
}

const RenewalNoAnswerEmail = ({
  name,
  cycleEndDate = 'el final de tu ciclo',
  manageUrl = 'https://autopilotplan.com/dashboard',
}: RenewalNoAnswerProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>No hemos recibido tu respuesta sobre tu plan</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Hola ${name},` : 'Hola,'}</Heading>
        <Text style={text}>
          Si no nos dices nada antes del <strong>{cycleEndDate}</strong>, te pasamos
          automáticamente al plan Completo (49€/mes) para que no pierdas seguimiento.
        </Text>
        <Text style={text}>
          Si prefieres renovar tu Transformación de 12 semanas o pausar, elígelo en tu panel.
        </Text>
        <Section style={buttonContainer}>
          <Button href={manageUrl} style={button}>
            Elegir qué hago al terminar
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>
          ¿Dudas? Responde a este correo o escríbenos por el chat de la app — te responde un
          entrenador real.
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RenewalNoAnswerEmail,
  subject: 'No hemos recibido tu respuesta sobre tu plan',
  displayName: 'Renovación sin respuesta (Transformación)',
  previewData: {
    name: 'Juan',
    cycleEndDate: '30 de octubre de 2026',
    manageUrl: 'https://autopilotplan.com/dashboard',
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
