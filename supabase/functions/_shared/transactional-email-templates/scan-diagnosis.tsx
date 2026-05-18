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
  physique?: number
  potential?: number
  headline?: string
  priorities?: Priority[]
  reportUrl?: string
}

const ScanDiagnosisEmail = ({
  name = 'atleta',
  physique,
  potential,
  headline = 'Tu diagnóstico físico está listo.',
  priorities = [],
  reportUrl = 'https://autopilotplan.com/scan',
}: ScanDiagnosisProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu diagnóstico físico de {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Hola {name}, este es tu diagnóstico</Heading>
        <Text style={text}>{headline}</Text>

        <Section style={card}>
          <Text style={cardTitle}>Físico actual</Text>
          <Text style={cardBody}>{typeof physique === 'number' ? physique.toFixed(1) : '-'} / 10</Text>
        </Section>

        <Section style={cardAccent}>
          <Text style={cardTitleAccent}>Tu potencial</Text>
          <Text style={cardBody}>{typeof potential === 'number' ? potential.toFixed(1) : '-'} / 10</Text>
        </Section>

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

export const template = {
  component: ScanDiagnosisEmail,
  subject: 'Tu diagnóstico físico de Autopilot',
  displayName: 'Scan diagnosis',
  previewData: {
    name: 'Nico',
    physique: 6.4,
    potential: 8.2,
    headline: 'Tu mayor margen está en espalda y hombros.',
    priorities: [
      { label: 'Volumen de espalda', priority: 'Alta' },
      { label: 'Definición abdominal', priority: 'Media' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const card = { background: '#f7f7f8', borderRadius: '12px', padding: '16px 18px', margin: '0 0 12px' }
const cardAccent = { background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '16px 18px', margin: '0 0 12px' }
const cardTitle = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }
const cardTitleAccent = { ...cardTitle, color: '#4f46e5' }
const cardBody = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.5', margin: '0 0 4px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', borderRadius: '10px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const }