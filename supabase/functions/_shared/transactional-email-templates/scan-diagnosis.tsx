/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Img,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface Priority {
  label: string
  priority: 'Alta' | 'Media' | 'Baja' | string
}

interface LockedInsight {
  label: string
  teaser: string
}

interface ScanDiagnosisProps {
  name?: string
  attractiveness?: number
  physique?: number
  potential?: number
  style?: number
  similarity?: number
  percentile?: number
  aestheticAge?: number
  monthsWithPlan?: number
  monthsWithoutPlan?: number
  headline?: string
  bottleneck?: string
  summary?: string
  priorities?: Priority[]
  lockedInsights?: LockedInsight[]
  photoUrl?: string
  reportUrl?: string
  cardImageUrl?: string
}

const ScanDiagnosisEmail = ({
  name = 'atleta',
  monthsWithPlan,
  headline = 'Tu diagnóstico físico está listo.',
  summary,
  reportUrl = 'https://autopilotplan.com/scan',
  cardImageUrl,
  photoUrl,
}: ScanDiagnosisProps) => {
  const fmt = (n?: number, d = 0) => (typeof n === 'number' ? n.toFixed(d) : '—')
  const imageSrc = cardImageUrl || photoUrl
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Saludo mínimo */}
          <Text style={greeting}>Hola {name},</Text>
          <Text style={subGreeting}>este es tu AI Physique Scan completo:</Text>

          {/* TARJETA DEL SCAN = el email es literalmente el análisis */}
          {imageSrc ? (
            <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
              <Img
                src={imageSrc}
                alt="Tu AI Physique Scan"
                width="560"
                style={cardImg}
              />
            </Section>
          ) : (
            <Section style={fallback}>
              <Text style={fallbackText}>{headline}</Text>
            </Section>
          )}

          {/* CTA gold/black brand */}
          <Section style={ctaSection}>
            <Text style={ctaTitle}>¿Listo para acelerarlo a {fmt(monthsWithPlan, 0)} meses?</Text>
            <Text style={ctaSub}>Plan de entrenamiento + nutrición, directo a tu Google Calendar.</Text>
            <Button href={reportUrl} style={button}>
              Empezar mi plan →
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>Diagnóstico generado por IA · {SITE_NAME}</Text>
          <Text style={footerSub}>autopilotplan.com</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ScanDiagnosisEmail,
  subject: 'Tu diagnóstico físico de Autopilot',
  displayName: 'Scan diagnosis',
  previewData: {
    name: 'Nico',
    monthsWithPlan: 6,
    headline: 'Tu mayor margen está en espalda y hombros.',
    summary: 'Buen pecho frontal pero cadena posterior infradesarrollada. Postura ligeramente cifótica.',
    cardImageUrl: 'https://placehold.co/1080x1350/0a0a0a/facc15?text=AI+Scan',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '24px 0' }
const container = { padding: '0 20px', maxWidth: '600px', margin: '0 auto' }
const greeting = { fontSize: '18px', fontWeight: 700, color: '#0a0a0a', margin: '0 0 4px', textAlign: 'center' as const }
const subGreeting = { fontSize: '13px', color: '#6b7280', margin: '0 0 18px', textAlign: 'center' as const }
const cardImg = { borderRadius: '20px', border: '1px solid #1a1a1a', maxWidth: '100%', height: 'auto' as const, display: 'block', margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
const fallback = { background: '#0a0a0a', borderRadius: '20px', padding: '32px 24px', margin: '0 0 24px', textAlign: 'center' as const }
const fallbackText = { fontSize: '18px', fontWeight: 700, color: '#facc15', margin: 0, lineHeight: '1.4' }
const ctaSection = { background: '#0a0a0a', borderRadius: '20px', padding: '28px 24px', margin: '8px 0 8px', textAlign: 'center' as const, border: '1px solid #facc15' }
const ctaTitle = { fontSize: '20px', fontWeight: 800, color: '#facc15', margin: '0 0 8px', lineHeight: '1.3', letterSpacing: '-0.01em' }
const ctaSub = { fontSize: '13px', color: '#e5e7eb', margin: '0 0 18px', lineHeight: '1.5' }
const button = { backgroundColor: '#facc15', color: '#0a0a0a', borderRadius: '12px', padding: '14px 28px', fontSize: '15px', fontWeight: 800, textDecoration: 'none', display: 'inline-block' }
const hr = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '28px 0 12px' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0', textAlign: 'center' as const, fontWeight: 600 }
const footerSub = { fontSize: '11px', color: '#9ca3af', margin: '4px 0 0', textAlign: 'center' as const }