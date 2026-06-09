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

interface WelcomePaidProps {
  name?: string
  dashboardUrl?: string
}

const WelcomePaidEmail = ({
  name,
  dashboardUrl = 'https://autopilotplan.com/dashboard',
}: WelcomePaidProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Pago confirmado · Tu plan personalizado se está preparando</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `¡Bienvenido, ${name}!` : '¡Bienvenido a Autopilot!'}
        </Heading>
        <Text style={text}>
          Hemos recibido tu pago correctamente. Ya formas parte de Autopilot.
        </Text>
        <Text style={text}>
          Tu plan de <strong>entrenamiento + nutrición</strong> personalizado se está generando
          ahora mismo según tu cuestionario. En cuanto esté listo recibirás un aviso en el
          dashboard y tus sesiones se sincronizarán automáticamente en tu Google Calendar.
        </Text>
        <Section style={buttonContainer}>
          <Button href={dashboardUrl} style={button}>
            Ir a mi dashboard
          </Button>
        </Section>
        <Hr style={hr} />
        <Heading as="h2" style={h2}>Qué pasa ahora</Heading>
        <Text style={text}>
          1. Revisa tu plan en el dashboard (entrenamiento + nutrición).<br />
          2. Conecta Google Calendar para recibir tus sesiones automáticamente.<br />
          3. Cualquier duda, escríbenos por el chat dentro de la app — te responde un entrenador real.
        </Text>
        <Hr style={hr} />
        <Text style={small}>
          Tu suscripción es de 19€/mes con 7 días de prueba gratuita. Puedes cancelar
          en cualquier momento desde Configuración → Suscripción.
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomePaidEmail,
  subject: '¡Bienvenido a Autopilot! Tu plan se está preparando 🚀',
  displayName: 'Bienvenida post-pago',
  previewData: {
    name: 'Juan',
    dashboardUrl: 'https://autopilotplan.com/dashboard',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '26px',
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
const buttonContainer = { margin: '28px 0', textAlign: 'center' as const }
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