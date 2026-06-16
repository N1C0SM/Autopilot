/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface Props { name?: string; ctaUrl?: string }

const Email = ({ name, ctaUrl = 'https://autopilotplan.com/dashboard?section=settings' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Último aviso: tu plan personalizado caduca en 48h</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `${name},` : 'Hola,'} es el último correo que te enviamos</Heading>
        <Text style={text}>
          Hace 5 días creaste tu plan personalizado y aún no lo has activado.
          En 48h dejaremos de guardarlo para liberar espacio para otros usuarios.
        </Text>
        <Text style={text}>
          Si activas ahora tienes:
        </Text>
        <Text style={text}>
          · 1ª semana <strong>completamente gratis</strong><br />
          · Garantía de 30 días: si no avanzas, te devolvemos todo<br />
          · Sin permanencia, cancelas en 1 clic
        </Text>
        <Section style={buttonContainer}>
          <Button href={ctaUrl} style={button}>Activar mi plan ahora</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>
          Si {SITE_NAME} no es para ti, no pasa nada — no volveremos a escribirte.
          Pero si llevas tiempo dándole vueltas, este es el momento.
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Último aviso: tu plan caduca en 48h',
  displayName: 'Lifecycle D+5 (último aviso)',
  previewData: { name: 'Juan', ctaUrl: 'https://autopilotplan.com/dashboard?section=settings' },
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