/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; ctaUrl?: string }

const Email = ({ name, ctaUrl = 'https://autopilotplan.com/onboarding' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu plan personalizado te está esperando — termina en 60 segundos</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>
            {name ? `${name}, ¿retomamos?` : '¿Retomamos donde lo dejaste?'}
          </Heading>
          <Text style={s.text}>
            Ayer empezaste a crear tu plan personalizado. Termina en menos de
            60 segundos y verás tu plan completo.
          </Text>
          <Text style={s.text}>
            Sin esto no podemos ajustar nada a tu cuerpo, equipamiento ni objetivos reales.
          </Text>
          <Section style={s.buttonContainer}>
            <Button href={ctaUrl} style={s.button}>Terminar mi plan</Button>
          </Section>
          <Hr style={s.hr} />
          <Text style={s.small}>
            Si tienes cualquier duda, responde a este correo. Te lee un entrenador real.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>— El equipo de Autopilot</Text>
        </Section>
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
