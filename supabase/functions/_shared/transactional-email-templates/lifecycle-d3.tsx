/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Img } from 'npm:@react-email/components@0.0.22'
import { email as s } from '../email-styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; ctaUrl?: string }

const Email = ({ name, ctaUrl = 'https://autopilotplan.com/dashboard?section=settings' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>La diferencia entre "algún día" y "ya estoy en ello"</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src="https://autopilotplan.com/pwa-192.png" width="44" height="44" alt="Autopilot" style={s.logoImg} />
          <Text style={s.logo}>Autopilot</Text>
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>
            {name ? `${name}, esto` : 'Esto'} es lo que separa a los que cambian
          </Heading>
          <Text style={s.text}>
            La mayoría empieza algo nuevo cada mes. Compra cursos, descarga apps, mira vídeos.
            Y a los 3 días vuelve al punto de partida.
          </Text>
          <Text style={s.text}>
            Autopilot no es un curso más. Es un plan que se adapta a ti cada semana,
            con un entrenador real al otro lado del chat. Si algo no encaja, lo ajustamos al día siguiente.
          </Text>
          <Text style={s.text}>
            <strong>Tienes 1ª semana gratis</strong> para probar sin pagar nada. Cancelas en 1 clic.
          </Text>
          <Section style={s.buttonContainer}>
            <Button href={ctaUrl} style={s.button}>Activar mi plan</Button>
          </Section>
          <Hr style={s.hr} />
          <Text style={s.small}>Garantía 30 días · sin permanencia · sin letra pequeña.</Text>
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
  subject: 'La diferencia entre "algún día" y "ya estoy en ello"',
  displayName: 'Lifecycle D+3 (objeción y prueba gratis)',
  previewData: { name: 'Juan', ctaUrl: 'https://autopilotplan.com/dashboard?section=settings' },
} satisfies TemplateEntry
