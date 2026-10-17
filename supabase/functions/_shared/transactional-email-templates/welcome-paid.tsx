/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface WelcomePaidProps {
  name?: string
  dashboardUrl?: string
}

const WelcomePaidEmail = ({ name, dashboardUrl = 'https://autopilotplan.com/dashboard' }: WelcomePaidProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Pago confirmado · Tu plan personalizado se está preparando</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.logo}>● Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>
            {name ? `Bienvenido, ${name}.` : 'Bienvenido a Autopilot.'}
          </Heading>
          <Text style={s.text}>
            Hemos recibido tu pago correctamente. Ya formas parte de Autopilot.
          </Text>
          <Text style={s.text}>
            Tu plan de <strong>entrenamiento + nutrición</strong> personalizado se está
            generando ahora mismo según tu cuestionario. En cuanto esté listo recibirás
            un aviso en el dashboard.
          </Text>
          <Section style={s.buttonContainer}>
            <Button href={dashboardUrl} style={s.button}>
              Ir a mi dashboard
            </Button>
          </Section>
          <Hr style={s.hr} />
          <Heading as="h2" style={s.h2}>Qué pasa ahora</Heading>
          <Text style={s.text}>
            1. Revisa tu plan en el dashboard (entrenamiento + nutrición).<br />
            2. Conecta Google Calendar para recibir tus sesiones automáticamente.<br />
            3. Cualquier duda, escríbenos por el chat — te responde un entrenador real.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Tu suscripción es mensual sin permanencia. Cancela en cualquier momento
            desde Configuración → Suscripción.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomePaidEmail,
  subject: 'Bienvenido a Autopilot · Tu plan se está preparando',
  displayName: 'Bienvenida post-pago',
  previewData: { name: 'Juan', dashboardUrl: 'https://autopilotplan.com/dashboard' },
} satisfies TemplateEntry
