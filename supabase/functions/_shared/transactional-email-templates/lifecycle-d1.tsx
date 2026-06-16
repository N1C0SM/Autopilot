/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface Props { name?: string; ctaUrl?: string }

const Email = ({ name, ctaUrl = 'https://autopilotplan.com/onboarding' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu plan personalizado te está esperando — termina en 60 segundos</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `${name},` : 'Hola,'} ¿retomamos donde lo dejaste?</Heading>
        <Text style={text}>
          Ayer empezaste a crear tu plan personalizado de entrenamiento y nutrición en {SITE_NAME}.
          Termina en menos de 60 segundos y verás tu plan completo.
        </Text>
        <Text style={text}>
          Sin esto no podemos ajustar nada a tu cuerpo, equipamiento ni objetivos reales.
        </Text>
        <Section style={buttonContainer}>
          <Button href={ctaUrl} style={button}>Terminar mi plan</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>Si tienes cualquier duda, responde a este correo. Te lee un entrenador real.</Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Tu plan está a 60 segundos de estar listo',
  displayName: 'Lifecycle D+1 (recordatorio plan)',
  previewData: { name: 'Juan', ctaUrl: 'https://autopilotplan.com/onboarding' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0b0b0b', margin: '0 0 20px', fontFamily: 'Space Grotesk, Inter, Arial, sans-serif' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '13px', color: '#666666', lineHeight: '1.6', margin: '0 0 16px' }
const buttonContainer = { margin: '24px 0', textAlign: 'center' as const }
const button = { backgroundColor: '#FFCC00', color: '#000000', fontSize: '15px', fontWeight: 700, padding: '14px 28px', borderRadius: '10px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const footer = { fontSize: '13px', color: '#888888', margin: '24px 0 0' }