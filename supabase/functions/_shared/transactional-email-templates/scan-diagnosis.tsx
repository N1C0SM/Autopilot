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
  const shortSummary = summary && summary.length > 220 ? summary.slice(0, 217) + '…' : summary
  const imageSrc = cardImageUrl || photoUrl
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* HERO */}
          <Section style={hero}>
            <Text style={kicker}>✦ AI PHYSIQUE SCAN ✦</Text>
            <Heading style={h1}>Hola {name},<br/>tu diagnóstico está listo</Heading>
          </Section>

          {/* TARJETA DEL SCAN como hero visual */}
          {imageSrc && (
            <Section style={{ textAlign: 'center', margin: '0 0 18px' }}>
              <Img
                src={imageSrc}
                alt="Tu AI Physique Scan"
                width="560"
                style={cardImg}
              />
            </Section>
          )}

          {/* Resumen corto */}
          {(headline || shortSummary) && (
            <Section style={card}>
              {headline && <Text style={cardHeadline}>{headline}</Text>}
              {shortSummary && <Text style={cardBody}>{shortSummary}</Text>}
            </Section>
          )}

          <Section style={ctaSection}>
            <Text style={ctaTitle}>¿Listo para acelerarlo a {fmt(monthsWithPlan, 0)} meses?</Text>
            <Text style={ctaSub}>Tu plan personalizado de entrenamiento + nutrición, entregado directo a tu Google Calendar.</Text>
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

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '20px 0' }
const container = { padding: '0 20px', maxWidth: '600px', margin: '0 auto' }
const hero = { background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)', borderRadius: '20px', padding: '28px 24px', margin: '0 0 14px', textAlign: 'center' as const }
const kicker = { fontSize: '11px', letterSpacing: '0.28em', color: '#a5b4fc', margin: '0 0 14px', fontWeight: 700 }
const h1 = { fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '0', lineHeight: '1.2', letterSpacing: '-0.01em' }
const cardImg = { borderRadius: '18px', border: '1px solid #e5e7eb', maxWidth: '100%', height: 'auto' as const, display: 'block', margin: '0 auto' }
const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px 20px', margin: '0 0 16px' }
const cardHeadline = { fontSize: '16px', fontWeight: 700, color: '#0a0a0a', margin: '0 0 8px', lineHeight: '1.4' }
const cardBody = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: 0 }
const ctaSection = { background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', borderRadius: '16px', padding: '24px 20px', margin: '20px 0 8px', textAlign: 'center' as const }
const ctaTitle = { fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px', lineHeight: '1.3' }
const ctaSub = { fontSize: '13px', color: '#e0e7ff', margin: '0 0 16px', lineHeight: '1.5' }
const button = { backgroundColor: '#ffffff', color: '#4f46e5', borderRadius: '12px', padding: '14px 28px', fontSize: '15px', fontWeight: 800, textDecoration: 'none', display: 'inline-block' }
const hr = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0', textAlign: 'center' as const, fontWeight: 600 }
const footerSub = { fontSize: '11px', color: '#9ca3af', margin: '4px 0 0', textAlign: 'center' as const }