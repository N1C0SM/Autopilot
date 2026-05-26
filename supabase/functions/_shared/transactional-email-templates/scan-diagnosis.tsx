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
}

const ScanDiagnosisEmail = ({
  name = 'atleta',
  attractiveness,
  physique,
  potential,
  style,
  similarity,
  percentile,
  aestheticAge,
  monthsWithPlan,
  monthsWithoutPlan,
  headline = 'Tu diagnóstico físico está listo.',
  bottleneck,
  summary,
  priorities = [],
  lockedInsights = [],
  photoUrl,
  reportUrl = 'https://autopilotplan.com/scan',
}: ScanDiagnosisProps) => {
  const fmt = (n?: number, d = 1) => (typeof n === 'number' ? n.toFixed(d) : '—')
  const pct = (n?: number) => Math.max(0, Math.min(100, ((n ?? 0) / 10) * 100))
  const scores: { label: string; value?: number; accent?: boolean }[] = [
    { label: 'Atractivo', value: attractiveness },
    { label: 'Potencial', value: potential, accent: true },
    { label: 'Físico', value: physique },
    { label: 'Estilo', value: style },
  ]
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
            <div style={heroBadge}>
              <Text style={heroBadgeText}>ANÁLISIS COMPLETO</Text>
            </div>
            {headline && <Text style={heroText}>"{headline}"</Text>}
          </Section>

          {/* HERO STATS */}
          {(typeof percentile === 'number' || typeof aestheticAge === 'number' || typeof monthsWithPlan === 'number') && (
            <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ margin: '0 0 18px' }}>
              <tbody>
                <tr>
                  {typeof percentile === 'number' && (
                    <td style={heroStatCell}>
                      <div style={heroStatBox}>
                        <Text style={heroStatLabel}>TU PERCENTIL</Text>
                        <Text style={heroStatBig}>Top {100 - percentile}%</Text>
                        <Text style={heroStatSub}>vs población</Text>
                      </div>
                    </td>
                  )}
                  {typeof aestheticAge === 'number' && (
                    <td style={heroStatCell}>
                      <div style={heroStatBox}>
                        <Text style={heroStatLabel}>EDAD ESTÉTICA</Text>
                        <Text style={heroStatBig}>{aestheticAge}</Text>
                        <Text style={heroStatSub}>años percibidos</Text>
                      </div>
                    </td>
                  )}
                  {typeof monthsWithPlan === 'number' && (
                    <td style={heroStatCell}>
                      <div style={heroStatBoxAccent}>
                        <Text style={heroStatLabelAccent}>A TU OBJETIVO</Text>
                        <Text style={heroStatBigAccent}>{monthsWithPlan}m</Text>
                        {typeof monthsWithoutPlan === 'number' && (
                          <Text style={heroStatSubAccent}>vs <span style={{ textDecoration: 'line-through' }}>{monthsWithoutPlan}m</span> sin plan</Text>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          )}

          {/* PHOTO + SCORES */}
          {photoUrl && (
            <Section style={{ textAlign: 'center', margin: '0 0 16px' }}>
              <Img src={photoUrl} alt="Tu scan" width="220" style={photo} />
            </Section>
          )}

          <Heading style={sectionTitle}>Tus scores</Heading>
          {scores.map((s, i) => (
            <table key={i} role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ margin: '0 0 10px' }}>
              <tbody>
                <tr>
                  <td style={s.accent ? scoreRowAccent : scoreRow}>
                    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%">
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: 'middle' }}>
                            <Text style={s.accent ? scoreLabelAccent : scoreLabel}>{s.label}</Text>
                          </td>
                          <td style={{ verticalAlign: 'middle', textAlign: 'right' as const, width: '90px' }}>
                            <Text style={s.accent ? scoreValueAccent : scoreValue}>
                              {fmt(s.value)}<span style={scoreOver}>/10</span>
                            </Text>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={2} style={{ paddingTop: '6px' }}>
                            <div style={barTrack}>
                              <div style={{ ...barFill, width: `${pct(s.value)}%`, background: s.accent ? '#4f46e5' : '#0a0a0a' }} />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          ))}

          {typeof similarity === 'number' && (
            <Section style={similarityBox}>
              <Text style={cardTitle}>SIMILITUD CON TU OBJETIVO</Text>
              <Text style={similarityValue}>{similarity}%</Text>
              <div style={barTrack}>
                <div style={{ ...barFill, width: `${Math.max(0, Math.min(100, similarity))}%`, background: '#4f46e5' }} />
              </div>
            </Section>
          )}

          {bottleneck && (
            <Section style={alertCard}>
              <Text style={alertKicker}>⚠ LO QUE MÁS TE FRENA</Text>
              <Text style={alertBody}>{bottleneck}</Text>
            </Section>
          )}

          {summary && (
            <Section style={card}>
              <Text style={cardTitle}>DIAGNÓSTICO</Text>
              <Text style={cardBody}>{summary}</Text>
            </Section>
          )}

          {priorities.length > 0 && (
            <Section style={card}>
              <Text style={cardTitle}>TUS PRIORIDADES</Text>
              {priorities.slice(0, 5).map((p, i) => (
                <table key={i} role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ marginBottom: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={priorityNum}>{i + 1}</td>
                      <td style={priorityText}>
                        <Text style={{ fontSize: '14px', color: '#0a0a0a', margin: 0, lineHeight: '1.4' }}>
                          {p.label} <span style={priorityBadge(p.priority)}>{p.priority}</span>
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ))}
            </Section>
          )}

          {lockedInsights.length > 0 && (
            <Section style={lockedCard}>
              <Text style={lockedKicker}>🔒 DESBLOQUEAR CON EL PLAN</Text>
              {lockedInsights.slice(0, 3).map((l, i) => (
                <div key={i} style={lockedItem}>
                  <Text style={lockedLabel}>{l.label}</Text>
                  <Text style={lockedTeaser}>{l.teaser}</Text>
                </div>
              ))}
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
    attractiveness: 6.8,
    physique: 6.4,
    potential: 8.2,
    style: 7.0,
    similarity: 62,
    percentile: 72,
    aestheticAge: 26,
    monthsWithPlan: 6,
    monthsWithoutPlan: 30,
    headline: 'Tu mayor margen está en espalda y hombros.',
    bottleneck: 'Espalda estrecha vs hombros, falta volumen en dorsales.',
    summary: 'Buen pecho frontal pero cadena posterior infradesarrollada. Postura ligeramente cifótica.',
    priorities: [
      { label: 'Volumen de espalda', priority: 'Alta' },
      { label: 'Definición abdominal', priority: 'Media' },
      { label: 'Trabajo de glúteos', priority: 'Media' },
    ],
    lockedInsights: [
      { label: 'Tu déficit calórico exacto', teaser: 'Calculado para tu masa magra' },
      { label: 'Frecuencia óptima de espalda', teaser: 'Para cerrar el V-taper' },
      { label: 'Orden ideal de ejercicios', teaser: 'Maximiza estímulo en 45 min' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '20px 0' }
const container = { padding: '0 20px', maxWidth: '600px', margin: '0 auto' }
const hero = { background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)', borderRadius: '20px', padding: '36px 28px', margin: '0 0 14px', textAlign: 'center' as const }
const kicker = { fontSize: '11px', letterSpacing: '0.28em', color: '#a5b4fc', margin: '0 0 14px', fontWeight: 700 }
const h1 = { fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '0 0 16px', lineHeight: '1.2', letterSpacing: '-0.01em' }
const heroBadge = { display: 'inline-block', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '999px', padding: '5px 14px', margin: '0 0 14px' }
const heroBadgeText = { fontSize: '10px', letterSpacing: '0.18em', color: '#4ade80', margin: 0, fontWeight: 700 }
const heroText = { fontSize: '15px', color: '#e4e4e7', lineHeight: '1.55', margin: '0', fontStyle: 'italic' as const }
const heroStatCell = { width: '33.33%', padding: '0 3px', verticalAlign: 'top' as const }
const heroStatBox = { background: '#f7f7f8', borderRadius: '14px', padding: '14px 8px', textAlign: 'center' as const, border: '1px solid #e5e7eb' }
const heroStatBoxAccent = { ...heroStatBox, background: '#eef2ff', borderColor: '#c7d2fe' }
const heroStatLabel = { fontSize: '9px', letterSpacing: '0.14em', color: '#6b7280', margin: '0 0 4px', fontWeight: 700 }
const heroStatLabelAccent = { ...heroStatLabel, color: '#4f46e5' }
const heroStatBig = { fontSize: '22px', fontWeight: 800, color: '#0a0a0a', margin: '0 0 2px', letterSpacing: '-0.01em' }
const heroStatBigAccent = { ...heroStatBig, color: '#4f46e5' }
const heroStatSub = { fontSize: '10px', color: '#9ca3af', margin: 0 }
const heroStatSubAccent = { ...heroStatSub, color: '#6366f1' }
const photo = { borderRadius: '14px', border: '1px solid #e5e7eb', objectFit: 'cover' as const, maxWidth: '100%' }
const sectionTitle = { fontSize: '13px', fontWeight: 700, color: '#0a0a0a', letterSpacing: '0.04em', margin: '20px 0 12px', textTransform: 'uppercase' as const }
const scoreRow = { background: '#f7f7f8', borderRadius: '14px', padding: '14px 18px', border: '1px solid #f0f0f0' }
const scoreRowAccent = { ...scoreRow, background: '#eef2ff', border: '1px solid #c7d2fe' }
const scoreLabel = { fontSize: '13px', color: '#374151', margin: 0, fontWeight: 600 }
const scoreLabelAccent = { ...scoreLabel, color: '#4f46e5' }
const scoreValue = { fontSize: '22px', fontWeight: 800, color: '#0a0a0a', margin: 0, letterSpacing: '-0.01em' }
const scoreValueAccent = { ...scoreValue, color: '#4f46e5' }
const scoreOver = { fontSize: '12px', color: '#9ca3af', fontWeight: 500 }
const barTrack = { background: '#e5e7eb', height: '6px', borderRadius: '999px', overflow: 'hidden' as const }
const barFill = { height: '6px', borderRadius: '999px' }
const similarityBox = { background: '#f7f7f8', borderRadius: '14px', padding: '16px 18px', margin: '14px 0' }
const similarityValue = { fontSize: '32px', fontWeight: 800, color: '#4f46e5', margin: '4px 0 10px', letterSpacing: '-0.02em' }
const alertCard = { background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderLeft: '4px solid #f59e0b', borderRadius: '12px', padding: '14px 18px', margin: '14px 0' }
const alertKicker = { fontSize: '10px', letterSpacing: '0.14em', color: '#92400e', margin: '0 0 4px', fontWeight: 700 }
const alertBody = { fontSize: '15px', color: '#0a0a0a', margin: 0, fontWeight: 600, lineHeight: '1.4' }
const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px 18px', margin: '0 0 12px' }
const cardTitle = { fontSize: '10px', letterSpacing: '0.14em', color: '#6b7280', margin: '0 0 8px', fontWeight: 700 }
const cardBody = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.6', margin: '0 0 4px' }
const priorityNum = { width: '28px', verticalAlign: 'top' as const, paddingTop: '2px' }
const priorityText = { verticalAlign: 'top' as const }
const priorityBadge = (p: string): React.CSSProperties => {
  const colors = p === 'Alta' ? { bg: '#fee2e2', fg: '#b91c1c' } : p === 'Media' ? { bg: '#fef3c7', fg: '#92400e' } : { bg: '#e0e7ff', fg: '#4338ca' }
  return { fontSize: '10px', fontWeight: 700, color: colors.fg, background: colors.bg, padding: '2px 8px', borderRadius: '999px', marginLeft: '6px' }
}
const lockedCard = { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '14px', padding: '18px', margin: '14px 0' }
const lockedKicker = { fontSize: '10px', letterSpacing: '0.18em', color: '#a5b4fc', margin: '0 0 12px', fontWeight: 700 }
const lockedItem = { padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }
const lockedLabel = { fontSize: '14px', color: '#ffffff', fontWeight: 700, margin: '0 0 2px' }
const lockedTeaser = { fontSize: '12px', color: '#a1a1aa', margin: 0, fontStyle: 'italic' as const }
const ctaSection = { background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', borderRadius: '16px', padding: '24px 20px', margin: '20px 0 8px', textAlign: 'center' as const }
const ctaTitle = { fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px', lineHeight: '1.3' }
const ctaSub = { fontSize: '13px', color: '#e0e7ff', margin: '0 0 16px', lineHeight: '1.5' }
const button = { backgroundColor: '#ffffff', color: '#4f46e5', borderRadius: '12px', padding: '14px 28px', fontSize: '15px', fontWeight: 800, textDecoration: 'none', display: 'inline-block' }
const hr = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0', textAlign: 'center' as const, fontWeight: 600 }
const footerSub = { fontSize: '11px', color: '#9ca3af', margin: '4px 0 0', textAlign: 'center' as const }