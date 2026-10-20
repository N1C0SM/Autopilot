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

const main = s.main
const container = { ...s.container, padding: '32px 24px' }
const h1 = s.h1
const text = s.text
const small = s.small
const buttonContainer = s.buttonContainer
const button = s.button
const hr = s.hr
const footer = s.footerText
