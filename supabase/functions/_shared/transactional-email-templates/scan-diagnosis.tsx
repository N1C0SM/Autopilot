/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface ScanDiagnosisProps {
  name?: string
  headline?: string
  summary?: string
  monthsWithPlan?: number
  monthsWithoutPlan?: number
  cardImageUrl?: string
  photoUrl?: string
  reportUrl?: string
  // scores (opcionales, se muestran si se pasan)
  attractiveness?: number
  physique?: number
  potential?: number
}

const ScanDiagnosisEmail = ({
  name = 'atleta',
  headline = 'Tu diagnóstico físico está listo.',
  summary,
  monthsWithPlan,
  reportUrl = 'https://autopilotplan.com/scan',
  cardImageUrl,
  photoUrl,
}: ScanDiagnosisProps) => {
  const imageSrc = cardImageUrl || photoUrl

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Tu AI Physique Scan está listo, {name}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>

          {/* ── Cabecera con logotipo ── */}
          <Section style={header}>
            <Text style={logoText}>Autopilot</Text>
            <Text style={tagline}>AI PHYSIQUE SCAN</Text>
          </Section>

          {/* ── Saludo ── */}
          <Section style={greetingSection}>
            <Text style={greetingName}>Hola, {name}.</Text>
            <Text style={greetingSubtitle}>
              Hemos completado tu análisis físico mediante inteligencia artificial.
            </Text>
          </Section>

          {/* ── Tarjeta del scan ── */}
          {imageSrc ? (
            <Section style={imageSection}>
              <Img
                src={imageSrc}
                alt="Tu AI Physique Scan"
                width="560"
                style={scanImage}
              />
            </Section>
          ) : (
            <Section style={fallbackCard}>
              <Text style={fallbackIcon}>◎</Text>
              <Text style={fallbackTitle}>{headline}</Text>
            </Section>
          )}

          {/* ── Diagnóstico textual ── */}
          {(headline || summary) && (
            <Section style={diagnosisSection}>
              <Text style={diagnosisLabel}>DIAGNÓSTICO</Text>
              {headline && <Text style={diagnosisHeadline}>"{headline}"</Text>}
              {summary && <Text style={diagnosisSummary}>{summary}</Text>}
            </Section>
          )}

          {/* ── CTA premium ── */}
          <Section style={ctaSection}>
            <Text style={ctaEyebrow}>TU PLAN PERSONALIZADO</Text>
            <Text style={ctaTitle}>
              {monthsWithPlan
                ? `Alcanza tu físico objetivo en ${monthsWithPlan} meses`
                : 'Transforma tu físico con un plan diseñado para ti'}
            </Text>
            <Text style={ctaBody}>
              Entrenamiento + nutrición adaptados a tu análisis.
              Directo a tu Google Calendar cada semana.
            </Text>
            <Button href={reportUrl} style={ctaButton}>
              Empezar mi plan →
            </Button>
          </Section>

          {/* ── Footer ── */}
          <Section style={s.footer}>
            <Text style={footerBrand}>Autopilot · AI Physique Scan</Text>
            <Text style={s.footerText}>
              Diagnóstico generado por inteligencia artificial.
              Los resultados son orientativos y no constituyen asesoramiento médico.
            </Text>
          </Section>

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
    monthsWithPlan: 4,
    headline: 'Físico frontal de alta definición muscular con un abdomen excepcional y gran desarrollo del tren inferior.',
    summary: 'Composición ~12-13% de grasa corporal, ~70-72 kg, somatotipo ecto-mesomorfo. Fuertes: abdominales visibles, pecho con buena inserción. Débiles: deltoides medio/posterior, espalda alta.',
    cardImageUrl: 'https://autopilotplan.com/__l5e/assets-v1/fa09bf52-3962-4e3f-9c3b-eeef3b241746/scan-example-user.jpg',
    reportUrl: 'https://autopilotplan.com/scan',
  },
} satisfies TemplateEntry

// ── Estilos ────────────────────────────────────────────────────────────────

// Cabecera con línea dorada inferior
const header: React.CSSProperties = {
  backgroundColor: '#000000',
  padding: '32px 32px 20px',
  borderBottom: '1px solid #38383A',
  textAlign: 'left' as const,
}

const logoText: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '20px',
  fontWeight: 700,
  color: '#C9A44A',
  letterSpacing: '-0.02em',
  margin: '0 0 2px',
}

const tagline: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", Arial, sans-serif',
  fontSize: '11px',
  fontWeight: 600,
  color: '#636366',
  letterSpacing: '0.12em',
  margin: '0',
}

// Saludo
const greetingSection: React.CSSProperties = {
  backgroundColor: '#000000',
  padding: '28px 32px 20px',
}

const greetingName: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '28px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.02em',
  lineHeight: '1.2',
  margin: '0 0 8px',
}

const greetingSubtitle: React.CSSProperties = {
  fontSize: '15px',
  color: '#98989E',
  lineHeight: '1.5',
  margin: '0',
}

// Imagen del scan — sin padding lateral para que ocupe todo el ancho
const imageSection: React.CSSProperties = {
  backgroundColor: '#000000',
  padding: '20px 0 0',
  textAlign: 'center' as const,
}

const scanImage: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '560px',
  height: 'auto',
  margin: '0 auto',
  borderRadius: '0',
  border: 'none',
}

// Fallback si no hay imagen
const fallbackCard: React.CSSProperties = {
  backgroundColor: '#1C1C1E',
  margin: '20px 32px 0',
  borderRadius: '20px',
  padding: '48px 32px',
  textAlign: 'center' as const,
  border: '1px solid #38383A',
}

const fallbackIcon: React.CSSProperties = {
  fontSize: '40px',
  color: '#C9A44A',
  margin: '0 0 16px',
  lineHeight: '1',
}

const fallbackTitle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '20px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.01em',
  lineHeight: '1.35',
  margin: '0',
}

// Sección de diagnóstico textual
const diagnosisSection: React.CSSProperties = {
  backgroundColor: '#000000',
  padding: '24px 32px',
  borderBottom: '1px solid #1C1C1E',
}

const diagnosisLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#C9A44A',
  letterSpacing: '0.1em',
  margin: '0 0 12px',
}

const diagnosisHeadline: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '22px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.015em',
  lineHeight: '1.3',
  margin: '0 0 12px',
}

const diagnosisSummary: React.CSSProperties = {
  fontSize: '15px',
  color: '#EBEBF5CC',
  lineHeight: '1.65',
  margin: '0',
}

// CTA premium — fondo negro con borde dorado
const ctaSection: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  margin: '0',
  padding: '32px 32px 36px',
  borderTop: '1px solid #C9A44A33',
  borderBottom: '1px solid #38383A',
}

const ctaEyebrow: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#C9A44A',
  letterSpacing: '0.1em',
  margin: '0 0 10px',
}

const ctaTitle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif',
  fontSize: '24px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.02em',
  lineHeight: '1.25',
  margin: '0 0 12px',
}

const ctaBody: React.CSSProperties = {
  fontSize: '15px',
  color: '#98989E',
  lineHeight: '1.55',
  margin: '0 0 24px',
}

const ctaButton: React.CSSProperties = {
  backgroundColor: '#C9A44A',
  color: '#000000',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}

// Footer
const footerBrand: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#636366',
  margin: '0 0 6px',
}
