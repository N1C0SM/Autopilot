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
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
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
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>{SITE_NAME}</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>{name ? `Hola ${name},` : 'Hola,'}</Heading>
          <Text style={s.text}>
            Si no nos dices nada antes del <strong>{cycleEndDate}</strong>, te pasamos
            automáticamente al plan Completo (49€/mes) para que no pierdas seguimiento.
          </Text>
          <Text style={s.text}>
            Si prefieres renovar tu Transformación de 12 semanas o pausar, elígelo en tu panel.
          </Text>
          <Section style={s.buttonContainer}>
            <Button href={manageUrl} style={s.button}>
              Elegir qué hago al terminar
            </Button>
          </Section>
          <Hr style={s.hr} />
          <Text style={s.small}>
            ¿Dudas? Responde a este correo o escríbenos por el chat de la app — te responde un
            entrenador real.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>— El equipo de {SITE_NAME}</Text>
        </Section>
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
