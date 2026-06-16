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
    <Preview>La diferencia entre "algún día" y "ya estoy en ello"</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `${name},` : 'Hola,'} esto es lo que separa a los que cambian</Heading>
        <Text style={text}>
          La mayoría empieza algo nuevo cada mes. Compra cursos, descarga apps, mira vídeos.
          Y a los 3 días vuelve al punto de partida.
        </Text>
        <Text style={text}>
          {SITE_NAME} no es un curso más. Es un plan que se adapta a ti cada semana,
          con un entrenador real al otro lado del chat. Si algo no encaja, lo ajustamos al día siguiente.
        </Text>
        <Text style={text}>
          <strong>Tienes 1ª semana gratis</strong> para probar sin pagar nada. Cancelas en 1 clic si no es para ti.
        </Text>
        <Section style={buttonContainer}>
          <Button href={ctaUrl} style={button}>Activar mi plan</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>Garantía 30 días · sin permanencia · sin letra pequeña.</Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'La diferencia entre "algún día" y "ya estoy en ello"',
  displayName: 'Lifecycle D+3 (objeción y prueba gratis)',
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