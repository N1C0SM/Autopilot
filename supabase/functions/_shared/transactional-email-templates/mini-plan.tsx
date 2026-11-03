/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
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
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>{SITE_NAME}</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Tu mini-plan está listo</Heading>
          <Text style={s.text}>
            Según tus respuestas, estas son tres recomendaciones prácticas para empezar:
          </Text>

          <Section style={s.card}>
            <Text style={s.h2}>Insight clave</Text>
            <Text style={s.text}>{insight}</Text>
          </Section>

          <Section style={s.card}>
            <Text style={s.h2}>El error que estás cometiendo</Text>
            <Text style={s.text}>{mistake}</Text>
          </Section>

          <Section style={s.card}>
            <Text style={s.h2}>Acción concreta para hoy</Text>
            <Text style={s.text}>{action}</Text>
          </Section>

          <Section style={s.buttonContainer}>
            <Button href={ctaUrl} style={s.button}>
              Quiero el plan completo (7 días gratis)
            </Button>
          </Section>

        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>
            Sin tarjeta para empezar · Cancela cuando quieras<br />
            — El equipo de {SITE_NAME}
          </Text>
        </Section>
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
