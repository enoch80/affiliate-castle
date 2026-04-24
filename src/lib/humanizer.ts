/**
 * Humanizer — Sprint 4
 *
 * Post-processes AI-generated content to reduce AI detection scores by
 * applying linguistic perturbations that mimic natural human writing patterns:
 *
 * 1. Burstiness injection — vary sentence lengths (mix short punchy + long)
 * 2. Perplexity variation — replace overly common AI phrases with alternatives
 * 3. Contraction expansion — add/vary contractions naturally
 * 4. Personal voice markers — inject first/second person anchors
 * 5. Structural variation — break monotonous paragraph patterns
 * 6. Transition diversity — replace repetitive transitions
 * 7. Fingerprint injection — niche-specific idioms and micro-imperfections
 */

// ─── Phrase replacement tables ────────────────────────────────────────────────

const AI_PHRASE_REPLACEMENTS: Array<[RegExp, string | string[]]> = [
  // Common AI openers
  [/\bIn today's (world|landscape|era|age|digital world)\b/gi, ["Right now", "These days", "At this point", "Today"]],
  [/\bIn conclusion\b/gi, ["To wrap this up", "Here's the bottom line", "So", "All in all"]],
  [/\bIt is important to note that\b/gi, ["Worth knowing:", "Keep in mind:", "Here's the thing —", "Note:"]],
  [/\bIt's worth (noting|mentioning) that\b/gi, ["Here's something:", "Quick note:", "One thing —", "Also:"]],
  [/\bFurthermore\b/gi, ["On top of that", "Plus", "And another thing", "What's more"]],
  [/\bMoreover\b/gi, ["On top of that", "Also", "And", "Beyond that"]],
  [/\bIn addition\b/gi, ["Also", "Plus", "On top of that", "And"]],
  [/\bAdditionally\b/gi, ["Also", "Plus", "And", "On top of that"]],
  [/\bNevertheless\b/gi, ["Still", "Even so", "That said", "But"]],
  [/\bHowever\b/gi, ["But", "Still", "That said", "Even so", "Yet"]],
  [/\bTherefore\b/gi, ["So", "That's why", "As a result", "Which means"]],
  [/\bSubsequently\b/gi, ["After that", "Then", "Next", "Following that"]],
  [/\bUtilize\b/gi, ["Use", "Apply", "Work with"]],
  [/\bUtilization\b/gi, ["use", "application"]],
  [/\bLeverage\b/gi, ["Use", "Apply", "Take advantage of", "Work with"]],
  [/\bOptimal\b/gi, ["best", "ideal", "top", "right"]],
  [/\bOptimize\b/gi, ["improve", "sharpen", "fine-tune", "get more from"]],
  [/\bIn order to\b/gi, ["To", "So you can", "To be able to"]],
  [/\bSignificantly\b/gi, ["noticeably", "clearly", "quite a bit", "a lot"]],
  [/\bSubstantially\b/gi, ["noticeably", "considerably", "quite a bit", "a fair amount"]],
  [/\bEnsure\b/gi, ["make sure", "confirm", "guarantee", "check"]],
  [/\bImplement\b/gi, ["use", "apply", "put in place", "set up"]],
  [/\bDemonstrate\b/gi, ["show", "prove", "reveal", "make clear"]],
  [/\bIndividuals\b/gi, ["people", "folks", "users", "readers"]],
  [/\bPrior to\b/gi, ["before", "ahead of", "leading up to"]],
  [/\bSubsequent\b/gi, ["later", "following", "next"]],
  [/\bInquire\b/gi, ["ask", "find out", "check"]],
  [/\bPurchase\b/gi, ["buy", "get", "pick up", "grab"]],
  [/\bPossess\b/gi, ["have", "own", "hold"]],
  [/\bCommencement\b/gi, ["start", "beginning", "kickoff"]],
  [/\bTerminate\b/gi, ["end", "stop", "finish", "cut off"]],
  // Formal constructions
  [/\bas a result of\b/gi, ["because of", "due to", "thanks to"]],
  [/\bdue to the fact that\b/gi, ["because", "since", "as"]],
  [/\bfor the purpose of\b/gi, ["to", "in order to", "so that"]],
  [/\bin the event that\b/gi, ["if", "when", "should"]],
  [/\bwith the exception of\b/gi, ["except", "aside from", "other than"]],
  // AI tells
  [/\bdelve into\b/gi, ["explore", "look at", "dig into", "examine"]],
  [/\btailored to\b/gi, ["built for", "designed for", "made for"]],
  [/\bseamlessly\b/gi, ["smoothly", "easily", "without friction"]],
  [/\brobust\b/gi, ["solid", "strong", "reliable", "powerful"]],
  [/\bpivotal\b/gi, ["key", "critical", "central", "core"]],
  [/\bcutting-edge\b/gi, ["modern", "current", "up-to-date", "new"]],
  [/\bstate-of-the-art\b/gi, ["modern", "advanced", "current", "new"]],
  [/\bgame-changer\b/gi, ["big shift", "real difference", "meaningful change"]],
  [/\bempowering\b/gi, ["helping", "enabling", "giving you control over"]],
  [/\bsimply put\b/gi, ["in short", "basically", "to put it plainly", "look"]],
  [/\bthe bottom line\b/gi, ["here's the deal", "what it comes down to", "the key point"]],
]

const TRANSITION_VARIANTS: Record<string, string[]> = {
  first: ["First,", "To start,", "Here's where to begin:", "Start here:"],
  second: ["Second,", "Next up,", "From there,", "After that,"],
  third: ["Third,", "And then,", "The third piece:", "Moving on,"],
  finally: ["Finally,", "Last but not least,", "And to round it out,", "To finish:"],
  also: ["Also,", "On top of that,", "Worth noting:", "And —"],
  however: ["But,", "That said,", "Here's the catch:", "The flip side:"],
}

// ─── Sentence-level operations ────────────────────────────────────────────────

function splitIntoSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [text]
}

/**
 * Inject burstiness: shorten some long sentences, combine some short ones
 */
function injectBurstiness(text: string): string {
  const sentences = splitIntoSentences(text)
  const result: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim()
    const wordCount = sentence.split(/\s+/).length

    // Very long sentence (>35 words) — split at a comma or conjunction
    if (wordCount > 35) {
      const splitPoint = sentence.search(/,\s+(but|and|so|yet|which|while|although|though|because)\b/i)
      if (splitPoint > 0) {
        const first = sentence.slice(0, splitPoint).trim() + '.'
        const second = sentence.slice(splitPoint + 1).trim()
        // Capitalise second sentence
        result.push(first, second.charAt(0).toUpperCase() + second.slice(1))
        continue
      }
    }

    // Two consecutive very short sentences (<7 words each) — merge them occasionally
    if (wordCount < 7 && i + 1 < sentences.length) {
      const next = sentences[i + 1].trim()
      const nextWords = next.split(/\s+/).length
      if (nextWords < 7) {
        // Merge with comma
        const merged = sentence.replace(/[.!?]$/, '') + ', and ' + next.charAt(0).toLowerCase() + next.slice(1)
        result.push(merged)
        i++ // skip next
        continue
      }
    }

    result.push(sentence)
  }

  return result.join(' ')
}

/**
 * Replace AI phrases with more natural alternatives (cycling through variants)
 */
function replaceAIPhrases(text: string): string {
  let result = text
  let counter = 0

  for (const [pattern, replacement] of AI_PHRASE_REPLACEMENTS) {
    const rep = Array.isArray(replacement)
      ? replacement[counter % replacement.length]
      : replacement
    counter++
    result = result.replace(pattern, rep)
  }

  return result
}

/**
 * Add/expand contractions for conversational tone
 */
function addContractions(text: string): string {
  return text
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bYou are\b/g, "You're")
    .replace(/\bThey are\b/g, "They're")
    .replace(/\bWe are\b/g, "We're")
    .replace(/\bIt is\b/g, "It's")
    .replace(/\bThat is\b/g, "That's")
    .replace(/\bDo not\b/g, "Don't")
    .replace(/\bDoes not\b/g, "Doesn't")
    .replace(/\bCannot\b/g, "Can't")
    .replace(/\bWill not\b/g, "Won't")
    .replace(/\bShould not\b/g, "Shouldn't")
    .replace(/\bWould not\b/g, "Wouldn't")
    .replace(/\bCould not\b/g, "Couldn't")
    .replace(/\bHave not\b/g, "Haven't")
    .replace(/\bHas not\b/g, "Hasn't")
    .replace(/\bIs not\b/g, "Isn't")
    .replace(/\bAre not\b/g, "Aren't")
    .replace(/\bWas not\b/g, "Wasn't")
    .replace(/\bWere not\b/g, "Weren't")
    .replace(/\bI have\b/g, "I've")
    .replace(/\bYou have\b/g, "You've")
    .replace(/\bWe have\b/g, "We've")
    .replace(/\bThey have\b/g, "They've")
    .replace(/\bI will\b/g, "I'll")
    .replace(/\bYou will\b/g, "You'll")
    .replace(/\bHe will\b/g, "He'll")
    .replace(/\bShe will\b/g, "She'll")
    .replace(/\bWe will\b/g, "We'll")
    .replace(/\bThey will\b/g, "They'll")
    .replace(/\bI would\b/g, "I'd")
    .replace(/\bYou would\b/g, "You'd")
}

/**
 * Replace repetitive list transitions with variety
 */
function diversifyTransitions(text: string): string {
  let result = text
  let firstCount = 0

  result = result.replace(/\bFirst(ly)?,?\s/gi, () => {
    const v = TRANSITION_VARIANTS.first[firstCount % TRANSITION_VARIANTS.first.length]
    firstCount++
    return v + ' '
  })

  let secondCount = 0
  result = result.replace(/\bSecond(ly)?,?\s/gi, () => {
    const v = TRANSITION_VARIANTS.second[secondCount % TRANSITION_VARIANTS.second.length]
    secondCount++
    return v + ' '
  })

  return result
}

/**
 * Inject micro-imperfections that signal human authorship
 */
function injectFingerprint(text: string): string {
  return text
    // Add em dashes for asides occasionally (replace comma-bracketed asides)
    .replace(/, (\w+[^,]{10,30}),/g, (match, inner) => ` — ${inner} —`)
    // Add parenthetical asides to occasional sentences
    .replace(/\. (The (key|point|thing|answer|issue|problem) is)/g, '. (And honestly,) $1')
    // Natural hedging
    .replace(/\. (Most people)/g, '. \nHere's the thing. $1')
    // Emphasise with italics in markdown
    .replace(/\b(only|never|always|every|none)\b/g, '_$1_')
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface HumanizationResult {
  original: string
  humanized: string
  changesApplied: string[]
}

/**
 * Humanize a piece of AI-generated content.
 * Returns the transformed text and a list of changes applied.
 */
export function humanize(text: string, contentType: string): HumanizationResult {
  const changes: string[] = []
  let result = text

  // Skip JSON content (captions, emails, FAQ arrays, etc.)
  const isJson = result.trim().startsWith('[') || result.trim().startsWith('{')
  if (isJson) {
    // Still process string values inside JSON
    try {
      const parsed = JSON.parse(result)
      if (Array.isArray(parsed)) {
        const processed = parsed.map((item: unknown) => {
          if (typeof item === 'string') return humanizeString(item)
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'string') {
                obj[key] = humanizeString(obj[key] as string)
              }
            }
            return obj
          }
          return item
        })
        return {
          original: text,
          humanized: JSON.stringify(processed, null, 2),
          changesApplied: ['json-string-humanized'],
        }
      }
    } catch {
      // Not valid JSON — fall through to normal processing
    }
  }

  // Skip HTML content (bridge page, lead magnet) — only process text nodes
  const isHtml = result.trim().startsWith('<')
  if (isHtml) {
    result = result.replace(/>([^<]+)</g, (_match, textNode) => {
      const processed = humanizeString(textNode)
      return `>${processed}<`
    })
    return { original: text, humanized: result, changesApplied: ['html-text-nodes-humanized'] }
  }

  // Prose content (articles, bridge page text)
  const before = result

  result = replaceAIPhrases(result)
  if (result !== before) changes.push('ai-phrases-replaced')

  result = addContractions(result)
  if (result !== result) changes.push('contractions-added')

  result = diversifyTransitions(result)
  changes.push('transitions-diversified')

  result = injectBurstiness(result)
  changes.push('burstiness-injected')

  // Only inject fingerprint for long-form content
  if (['article_devto', 'article_hashnode', 'article_blogger', 'article_tumblr', 'lead_magnet'].includes(contentType)) {
    result = injectFingerprint(result)
    changes.push('fingerprint-injected')
  }

  return { original: text, humanized: result, changesApplied: changes }
}

function humanizeString(text: string): string {
  let result = replaceAIPhrases(text)
  result = addContractions(result)
  return result
}
