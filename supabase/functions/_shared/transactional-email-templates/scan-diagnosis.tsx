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
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Autopilot'

interface Priority {
  label: string
  priority: 'Alta' | 'Media' | 'Baja' | string
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
  reportUrl = 'https://autopilotplan.com/scan',
}: ScanDiagnosisProps) => {
  const fmt = (n?: number, d = 1) => (typeof n === 'number' ? n.toFixed(d) : '-')
  const scores: { label: string; value?: number; accent?: boolean }[] = [
    { label: 'Atractivo', value: attractiveness },
    { label: 'Potencial', value: potential, accent: true },
    { label: 'Físico', value: physique },
    { label: 'Estilo', value: style },
  ]
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Tu AI Physique Scan está listo · {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={hero}>
            <Text style={kicker}>AI PHYSIQUE SCAN</Text>
            <Heading style={h1}>Hola {name}, tu diagnóstico está listo</Heading>
            {headline && <Text style={heroText}>{headline}</Text>}
          </Section>

          <Section style={scoresGrid}>
            {scores.map((s, i) => (
              <table key={i} role="presentation" cellPadding={0} cellSpacing={0} style={scoreCell}>
                <tbody>
                  <tr>
                    <td style={s.accent ? scoreBoxAccent : scoreBox}>
                      <Text style={s.accent ? scoreLabelAccent : scoreLabel}>{s.label}</Text>
                      <Text style={s.accent ? scoreValueAccent : scoreValue}>
                        {fmt(s.value)}<span style={scoreOver}> / 10</span>
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </Section>

          {(typeof similarity === 'number' || typeof percentile === 'number' || typeof aestheticAge === 'number') && (
            <Section style={statsRow}>
              {typeof percentile === 'number' && (
                <Text style={statItem}><span style={statValue}>Top {100 - percentile}%</span><br /><span style={statSub}>vs población</span></Text>
              )}
              {typeof aestheticAge === 'number' && (
                <Text style={statItem}><span style={statValue}>{aestheticAge}</span><br /><span style={statSub}>edad estética</span></Text>
              )}
              {typeof similarity === 'number' && (
                <Text style={statItem}><span style={statValue}>{similarity}%</span><br /><span style={statSub}>similitud objetivo</span></Text>
              )}
            </Section>
          )}

          {(typeof monthsWithPlan === 'number' || typeof monthsWithoutPlan === 'number') && (
            <Section style={timeBox}>
              <Text style={timeKicker}>TIEMPO ESTIMADO HASTA TU OBJETIVO</Text>
              <Text style={timeMain}>
                {typeof monthsWithPlan === 'number' ? `${monthsWithPlan} meses` : '-'} <span style={timeSub}>con plan</span>
              </Text>
              {typeof monthsWithoutPlan === 'number' && (
                <Text style={timeStrike}>vs <span style={{ textDecoration: 'line-through' }}>{monthsWithoutPlan} meses</span> sin plan</Text>
              )}
            </Section>
          )}

          {bottleneck && (
            <Section style={card}>
              <Text style={cardTitle}>Tu mayor bloqueo</Text>
              <Text style={cardBody}>{bottleneck}</Text>
            </Section>
          )}

          {summary && (
            <Section style={card}>
              <Text style={cardTitle}>Diagnóstico</Text>
              <Text style={cardBody}>{summary}</Text>
            </Section>
          )}

          {priorities.length > 0 && (
            <Section style={card}>
              <Text style={cardTitle}>Tus prioridades</Text>
              {priorities.slice(0, 5).map((p, i) => (
                <Text key={i} style={cardBody}>
                  {i + 1}. {p.label} <span style={{ color: '#6b7280' }}>({p.priority})</span>
                </Text>
              ))}
            </Section>
          )}

          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button href={reportUrl} style={button}>
              Ver mi informe completo
            </Button>
          </Section>

          <Text style={footer}>— El equipo de {SITE_NAME}</Text>
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
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const hero = { background: '#0a0a0a', borderRadius: '16px', padding: '24px', margin: '0 0 16px', textAlign: 'center' as const }
const kicker = { fontSize: '11px', letterSpacing: '0.18em', color: '#a5b4fc', margin: '0 0 8px', fontWeight: 700 }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 10px', lineHeight: '1.25' }
const heroText = { fontSize: '14px', color: '#d4d4d8', lineHeight: '1.6', margin: '0' }
const scoresGrid = { margin: '0 0 12px' }
const scoreCell = { width: '49%', display: 'inline-table' as const, margin: '0 0.5% 8px' }
const scoreBox = { background: '#f7f7f8', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' as const }
const scoreBoxAccent = { ...scoreBox, background: '#eef2ff', border: '1px solid #c7d2fe' }
const scoreLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', margin: '0 0 4px', fontWeight: 600 }
const scoreLabelAccent = { ...scoreLabel, color: '#4f46e5' }
const scoreValue = { fontSize: '24px', fontWeight: 800, color: '#0a0a0a', margin: 0 }
const scoreValueAccent = { ...scoreValue, color: '#4f46e5' }
const scoreOver = { fontSize: '12px', color: '#9ca3af', fontWeight: 500 }
const statsRow = { background: '#f7f7f8', borderRadius: '12px', padding: '14px 8px', margin: '0 0 12px', textAlign: 'center' as const }
const statItem = { display: 'inline-block', width: '32%', textAlign: 'center' as const, margin: 0, verticalAlign: 'top' as const }
const statValue = { fontSize: '16px', fontWeight: 800, color: '#0a0a0a' }
const statSub = { fontSize: '11px', color: '#6b7280' }
const timeBox = { background: '#0a0a0a', borderRadius: '12px', padding: '16px 18px', margin: '0 0 12px', textAlign: 'center' as const }
const timeKicker = { fontSize: '10px', letterSpacing: '0.16em', color: '#a5b4fc', margin: '0 0 6px', fontWeight: 700 }
const timeMain = { fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }
const timeSub = { fontSize: '13px', fontWeight: 500, color: '#a1a1aa' }
const timeStrike = { fontSize: '12px', color: '#9ca3af', margin: 0 }
const card = { background: '#f7f7f8', borderRadius: '12px', padding: '16px 18px', margin: '0 0 12px' }
const cardTitle = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }
const cardBody = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.5', margin: '0 0 4px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', borderRadius: '10px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const }