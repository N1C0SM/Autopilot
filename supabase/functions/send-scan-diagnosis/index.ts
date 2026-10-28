import { emailFeatureHandler } from '../_shared/email-feature-handler.ts'
Deno.serve(emailFeatureHandler('scan-diagnosis', false))
