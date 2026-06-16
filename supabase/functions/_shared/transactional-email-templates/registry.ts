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
import { template as lifecycleD1 } from './lifecycle-d1.tsx'
import { template as lifecycleD3 } from './lifecycle-d3.tsx'
import { template as lifecycleD5 } from './lifecycle-d5.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payment-reminder': paymentReminder,
  'mini-plan': miniPlan,
  'scan-diagnosis': scanDiagnosis,
  'welcome-paid': welcomePaid,
  'trial-ending': trialEnding,
  'lifecycle-d1': lifecycleD1,
  'lifecycle-d3': lifecycleD3,
  'lifecycle-d5': lifecycleD5,
}