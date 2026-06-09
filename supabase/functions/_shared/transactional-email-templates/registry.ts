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
import { template as scanDiagnosis } from './scan-diagnosis.tsx'
import { template as welcomePaid } from './welcome-paid.tsx'
import { template as trialEnding } from './trial-ending.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payment-reminder': paymentReminder,
  'mini-plan': miniPlan,
  'scan-diagnosis': scanDiagnosis,
  'welcome-paid': welcomePaid,
  'trial-ending': trialEnding,
}