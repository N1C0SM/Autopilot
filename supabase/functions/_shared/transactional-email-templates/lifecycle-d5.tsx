/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; ctaUrl?: string }

const Email = ({ name, ctaUrl = 'https://autopilotplan.com/dashboard?section=settings' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Último aviso: tu plan personalizado caduca en 48h</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>
            {name ? `${name}, es` : 'Es'} el último correo que te enviamos
          </Heading>
          <Text style={s.text}>
            Hace 5 días creaste tu plan personalizado y aún no lo has activado.
            En 48h dejaremos de guardarlo para liberar espacio.
          </Text>
          <Text style={s.text}>Si activas ahora tienes:</Text>
          <Section style={s.card}>
            <Text style={{ ...s.text, margin: 0 }}>
              · 1ª semana <strong style={{ color: '#C9A44A' }}>completamente gratis</strong><br />
              · Garantía de 30 días: si no avanzas, te devolvemos todo<br />
              · Sin permanencia, cancelas en 1 clic
            </Text>
          </Section>
          <Section style={s.buttonContainer}>
            <Button href={ctaUrl} style={s.button}>Activar mi plan ahora</Button>
          </Section>
          <Hr style={s.hr} />
          <Text style={s.small}>
            Si Autopilot no es para ti, no pasa nada — no volveremos a escribirte.
            Pero si llevas tiempo dándole vueltas, este es el momento.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>— El equipo de Autopilot</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Último aviso: tu plan caduca en 48h',
  displayName: 'Lifecycle D+5 (último aviso)',
  previewData: { name: 'Juan', ctaUrl: 'https://autopilotplan.com/dashboard?section=settings' },
} satisfies TemplateEntry
