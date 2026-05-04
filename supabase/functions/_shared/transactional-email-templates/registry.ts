/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as paymentReminder } from './payment-reminder.tsx'
import { template as miniPlan } from './mini-plan.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payment-reminder': paymentReminder,
  'mini-plan': miniPlan,
}