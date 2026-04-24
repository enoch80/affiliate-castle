/**
 * Email drip scheduler for Sprint 9.
 *
 * Creates EmailSequence + EmailSequenceStep records in DB,
 * then enqueues each step as a BullMQ EMAIL_DRIP job with day-based delay.
 *
 * Also handles subscribing a new lead to Listmonk.
 */
import { getQueue, QUEUE_NAMES } from './queue'
import { generateFullSequence, EmailTemplateInput } from './email-sequence'
import { checkSpamScore } from './spam-checker'
import { subscribeToList } from './listmonk'
import { prisma } from './prisma'

export interface DripScheduleInput extends EmailTemplateInput {
  campaignId: string
  subscriberEmail: string
  subscriberFirstName: string
}

export interface DripScheduleResult {
  sequenceId: string
  stepsCreated: number
  stepsBlocked: number
  listmonkSubscriberId: number | null
  warnings: string[]
}

export async function scheduleDripSequence(input: DripScheduleInput): Promise<DripScheduleResult> {
  const {
    campaignId,
    subscriberEmail,
    subscriberFirstName,
    ...templateInput
  } = input

  const templates = generateFullSequence(templateInput)
  const warnings: string[] = []
  let stepsBlocked = 0

  // 1. Subscribe to Listmonk
  let listmonkSubscriberId: number | null = null
  const subResult = await subscribeToList(
    subscriberEmail,
    subscriberFirstName,
    templateInput.niche
  )
  if (subResult.ok && subResult.subscriberId) {
    listmonkSubscriberId = subResult.subscriberId

    // Save listmonkId to EmailSubscriber record if present
    await prisma.emailSubscriber.upsert({
      where: { email: subscriberEmail },
      update: { listmonkId: subResult.subscriberId, status: 'active' },
      create: {
        email: subscriberEmail,
        firstName: subscriberFirstName,
        nicheTag: templateInput.niche,
        sourceCampaignId: campaignId,
        listmonkId: subResult.subscriberId,
        status: 'active',
      },
    })
  } else {
    warnings.push(`Listmonk subscribe failed: ${subResult.error ?? 'unknown'}`)
  }

  // 2. Create EmailSequence record
  const sequence = await prisma.emailSequence.create({
    data: {
      campaignId,
      name: `${templateInput.campaignName} — Drip Sequence`,
    },
    select: { id: true },
  })

  // 3. Run spam check + create steps + enqueue jobs
  const queue = getQueue(QUEUE_NAMES.EMAIL_DRIP)
  const now = new Date()

  for (const template of templates) {
    const spamResult = checkSpamScore(template.subject, template.bodyHtml)

    if (spamResult.verdict === 'blocked') {
      stepsBlocked++
      warnings.push(
        `Email ${template.stepNumber} blocked (spam score ${spamResult.score}): ${spamResult.issues[0] ?? 'unknown'}`
      )
      continue
    }

    if (spamResult.verdict === 'warning') {
      warnings.push(
        `Email ${template.stepNumber} spam warning (score ${spamResult.score}): ${spamResult.issues[0] ?? 'unknown'}`
      )
    }

    // Persist the step
    const step = await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        stepNumber: template.stepNumber,
        delayDays: template.delayDays,
        subject: template.subject,
        previewText: template.previewText ?? '',
        bodyHtml: template.bodyHtml,
      },
      select: { id: true },
    })

    // Delay from now
    const scheduledAt = new Date(now)
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + template.delayDays)
    scheduledAt.setUTCHours(9, 0, 0, 0) // 9 AM UTC send time

    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now())

    await queue.add(
      'send-email',
      {
        sequenceStepId: step.id,
        subscriberEmail,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        spamScore: spamResult.score,
        isReEngage: template.isReEngage,
      },
      {
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 300000 }, // 5-min backoff
        jobId: `email-step-${step.id}-${subscriberEmail}`,
        removeOnComplete: { count: 200 },
        removeOnFail: false,
      }
    )
  }

  const stepsCreated = templates.length - stepsBlocked

  return {
    sequenceId: sequence.id,
    stepsCreated,
    stepsBlocked,
    listmonkSubscriberId,
    warnings,
  }
}
