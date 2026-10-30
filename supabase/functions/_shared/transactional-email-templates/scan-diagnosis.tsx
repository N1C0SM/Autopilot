/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Column, Container, Head, Html, Img, Preview, Row, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

/**
 * Correo del AI Scan con la firma de la app (`.claude/design/marca.md`): negro, el dorado de la
 * app sin brillos, tarjetas sin borde de 22/28 px, cifras grandes redondeadas, botón en píldora
 * y una sola «A» con el rayo. Las secciones sin datos no se pintan.
 */

interface Priority {
  label?: string
  priority?: string
}

interface ScanDiagnosisProps {
  name?: string
  headline?: string
  summary?: string
  bottleneck?: string
  priorities?: Priority[]
  monthsWithPlan?: number
  monthsWithoutPlan?: number
  cardImageUrl?: string
  photoUrl?: string
  reportUrl?: string
  attractiveness?: number
  physique?: number
  potential?: number
  style?: number
}

const GOLD = '#D6B45B'
const LOGO = 'https://autopilotplan.com/pwa-192.png'

const figure = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : null

const months = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? `${Math.round(n)} ${Math.round(n) === 1 ? 'mes' : 'meses'}` : null

const ScanDiagnosisEmail = ({
  name = 'atleta',
  headline,
  summary,
  bottleneck,
  priorities,
  monthsWithPlan,
  monthsWithoutPlan,
  reportUrl = 'https://autopilotplan.com/onboarding',
  cardImageUrl,
  photoUrl,
  attractiveness,
  physique,
  potential,
  style,
}: ScanDiagnosisProps) => {
  const imageSrc = cardImageUrl || photoUrl
  const physiqueText = figure(physique)
  const tiles = ([
    ['Potencial', figure(potential), true],
    ['Atractivo', figure(attractiveness), false],
    ['Estilo', figure(style), false],
  ] as const).filter(([, value]) => value)
  const todo = (Array.isArray(priorities) ? priorities : []).filter((p) => p?.label).slice(0, 4)
  const withPlan = months(monthsWithPlan)
  const withoutPlan = months(monthsWithoutPlan)
  // Con cuenta abre su análisis; un visitante aún no tiene dónde verlo y va a crear su rutina.
  const cta = /\/dashboard/.test(reportUrl) ? 'Ver mi análisis completo' : 'Crear mi rutina gratis'

  return (
    <Html lang="es" dir="ltr">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>{physiqueText ? `${name}, tu físico: ${physiqueText}/10. Este es tu punto de partida.` : `${name}, tu AI Scan está listo.`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>

          <Section style={s.header}>
            <Img src={LOGO} width="44" height="44" alt="Autopilot" style={s.logoImg} />
            <Text style={s.logo}>Autopilot</Text>
          </Section>

          {/* Titular de tres frases con la última en dorado, como la landing. */}
          <Section style={hero}>
            <Text style={eyebrow}>AI SCAN · TU DIAGNÓSTICO</Text>
            <Text style={heroTitle}>
              Tu físico, medido.<br />
              Tus prioridades, claras.<br />
              <span style={{ color: GOLD }}>Ahora, a progresar.</span>
            </Text>
            <Text style={heroLead}>
              Hola, {name}. Este es tu punto de partida: lo que la IA ve en tus fotos y por dónde empezar.
            </Text>
          </Section>

          {physiqueText && (
            <Section style={pad}>
              <div style={scoreCard}>
                <Text style={label}>Tu físico</Text>
                <Text style={scoreFigure}>
                  {physiqueText}<span style={scoreOutOf}>/10</span>
                </Text>
                <Text style={muted}>Puntuación global de tu físico</Text>
              </div>
            </Section>
          )}

          {tiles.length > 0 && (
            <Section style={tilesSection}>
              <Row>
                {tiles.map(([title, value, accent]) => (
                  <Column key={title} style={tileColumn}>
                    <div style={tile}>
                      <Text style={label}>{title}</Text>
                      <Text style={{ ...tileFigure, color: accent ? GOLD : '#FFFFFF' }}>{value}</Text>
                    </div>
                  </Column>
                ))}
              </Row>
            </Section>
          )}

          {imageSrc && (
            <Section style={pad}>
              <Img src={imageSrc} alt="Tu AI Scan" width="496" style={photo} />
            </Section>
          )}

          {(headline || summary) && (
            <Section style={pad}>
              <div style={card}>
                <Text style={eyebrow}>LECTURA DE LA IA</Text>
                {headline && <Text style={quote}>«{headline}»</Text>}
                {summary && <Text style={{ ...muted, margin: 0 }}>{summary}</Text>}
              </div>
            </Section>
          )}

          {bottleneck && (
            <Section style={pad}>
              <div style={card}>
                <Text style={eyebrow}>LO QUE MÁS TE FRENA</Text>
                <Text style={strong}>{bottleneck}</Text>
              </div>
            </Section>
          )}

          {todo.length > 0 && (
            <Section style={pad}>
              <div style={card}>
                <Text style={cardTitle}>Qué mejorar</Text>
                {todo.map((p, i) => (
                  <Row key={i} style={i ? priorityRowSpaced : priorityRow}>
                    <Column style={priorityLabel}>{p.label}</Column>
                    {p.priority && (
                      <Column align="right" style={{ width: '1%', whiteSpace: 'nowrap' }}>
                        <span style={pill(p.priority)}>{p.priority}</span>
                      </Column>
                    )}
                  </Row>
                ))}
              </div>
            </Section>
          )}

          {withPlan && (
            <Section style={pad}>
              <div style={card}>
                <Text style={eyebrow}>TIEMPO HASTA TU OBJETIVO</Text>
                <Row>
                  <Column style={halfColumn}>
                    <Text style={label}>Con un plan</Text>
                    <Text style={{ ...monthsFigure, color: GOLD }}>{withPlan}</Text>
                  </Column>
                  {withoutPlan && (
                    <Column style={halfColumn}>
                      <Text style={label}>Por tu cuenta</Text>
                      <Text style={{ ...monthsFigure, color: '#98989E' }}>{withoutPlan}</Text>
                    </Column>
                  )}
                </Row>
                <Text style={{ ...small, margin: '12px 0 0' }}>Estimación orientativa de la IA.</Text>
              </div>
            </Section>
          )}

          <Section style={ctaSection}>
            <Button href={reportUrl} style={ctaButton}>{cta}</Button>
          </Section>

          <Section style={s.footer}>
            <Text style={footerBrand}>Entrena con plan. Registra cada serie. Mira cómo progresas.</Text>
            <Text style={s.footerText}>
              Lectura estimada por IA a partir de tus fotos. Es una estimación visual, no un diagnóstico médico.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ScanDiagnosisEmail,
  subject: 'Tu AI Scan de Autopilot está listo',
  displayName: 'Scan diagnosis',
  previewData: {
    name: 'Nico',
    physique: 6.8,
    potential: 8.6,
    attractiveness: 7.2,
    style: 6.5,
    monthsWithPlan: 4,
    monthsWithoutPlan: 11,
    headline: 'Base atlética sólida con el tren superior por delante de las piernas.',
    summary: 'Composición en torno al 14-16 % de grasa, hombros y pecho bien desarrollados y un core visible. Las piernas y la espalda alta tienen más margen.',
    bottleneck: 'Volumen de piernas por debajo del tren superior.',
    priorities: [
      { label: 'Cuádriceps y glúteos', priority: 'Alta' },
      { label: 'Espalda alta y deltoides posterior', priority: 'Media' },
      { label: 'Definición abdominal', priority: 'Baja' },
    ],
    cardImageUrl: 'https://autopilotplan.com/__l5e/assets-v1/fa09bf52-3962-4e3f-9c3b-eeef3b241746/scan-example-user.jpg',
    reportUrl: 'https://autopilotplan.com/onboarding',
  },
} satisfies TemplateEntry

// ── Estilos ────────────────────────────────────────────────────────────────

const DISPLAY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif'
// Cifras redondeadas como en la app (SF Rounded donde existe).
const ROUNDED = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Inter", Arial, sans-serif'

const pad: React.CSSProperties = { padding: '0 28px 12px' }

// Halo dorado muy tenue detrás del titular (≈14 %), nunca brillos.
const hero: React.CSSProperties = {
  padding: '36px 28px 28px',
  backgroundImage: 'radial-gradient(closest-side, rgba(214,180,91,0.14), rgba(214,180,91,0))',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right -120px top -140px',
  backgroundSize: '420px 420px',
}

const eyebrow: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: GOLD,
  letterSpacing: '0.15em',
  margin: '0 0 12px',
}

const heroTitle: React.CSSProperties = {
  fontFamily: ROUNDED,
  fontSize: '34px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.03em',
  lineHeight: '1.08',
  margin: '0 0 16px',
}

const heroLead: React.CSSProperties = {
  fontSize: '16px',
  color: '#98989E',
  lineHeight: '1.5',
  margin: '0',
}

const card: React.CSSProperties = {
  backgroundColor: '#111216',
  borderRadius: '22px',
  padding: '20px 22px',
}

const scoreCard: React.CSSProperties = {
  ...card,
  borderRadius: '28px',
  padding: '24px 24px 22px',
  backgroundImage: 'radial-gradient(closest-side, rgba(214,180,91,0.14), rgba(214,180,91,0))',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right -80px center',
  backgroundSize: '320px 320px',
}

const label: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#98989E',
  margin: '0 0 4px',
}

const scoreFigure: React.CSSProperties = {
  fontFamily: ROUNDED,
  fontSize: '72px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.04em',
  lineHeight: '1',
  margin: '0 0 8px',
  fontVariantNumeric: 'tabular-nums',
}

const scoreOutOf: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 600,
  color: '#98989E',
  letterSpacing: '0',
  marginLeft: '4px',
}

const muted: React.CSSProperties = {
  fontSize: '15px',
  color: '#98989E',
  lineHeight: '1.55',
  margin: '0',
}

const small: React.CSSProperties = {
  fontSize: '13px',
  color: '#636366',
  lineHeight: '1.5',
}

const tilesSection: React.CSSProperties = { padding: '0 22px 12px' }

const tileColumn: React.CSSProperties = { padding: '0 6px', verticalAlign: 'top' }

const tile: React.CSSProperties = {
  ...card,
  padding: '16px 16px 14px',
}

const tileFigure: React.CSSProperties = {
  fontFamily: ROUNDED,
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: '1.1',
  margin: '0',
  fontVariantNumeric: 'tabular-nums',
}

const monthsFigure: React.CSSProperties = { ...tileFigure, fontSize: '24px', whiteSpace: 'nowrap' }

const halfColumn: React.CSSProperties = { width: '50%', verticalAlign: 'top' }

const photo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '496px',
  height: 'auto',
  borderRadius: '28px',
  border: 'none',
}

const quote: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: '20px',
  fontWeight: 700,
  color: '#FFFFFF',
  letterSpacing: '-0.01em',
  lineHeight: '1.35',
  margin: '0 0 10px',
}

const strong: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 600,
  color: '#FFFFFF',
  lineHeight: '1.45',
  margin: '0',
}

const cardTitle: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: '20px',
  fontWeight: 700,
  color: '#FFFFFF',
  margin: '0 0 14px',
}

const priorityRow: React.CSSProperties = { width: '100%' }
const priorityRowSpaced: React.CSSProperties = { width: '100%', marginTop: '12px' }

const priorityLabel: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#FFFFFF',
  lineHeight: '1.4',
  paddingRight: '12px',
}

// «Alta» en dorado; el resto, neutro.
const pill = (priority: string): React.CSSProperties => ({
  display: 'inline-block',
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700,
  backgroundColor: /alta/i.test(priority) ? 'rgba(214,180,91,0.15)' : 'rgba(255,255,255,0.08)',
  color: /alta/i.test(priority) ? GOLD : '#98989E',
})

const ctaSection: React.CSSProperties = { padding: '16px 28px 36px' }

const ctaButton: React.CSSProperties = {
  ...s.button,
  display: 'block',
  textAlign: 'center' as const,
  fontSize: '17px',
  padding: '16px 28px',
}

const footerBrand: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#98989E',
  margin: '0 0 6px',
}
