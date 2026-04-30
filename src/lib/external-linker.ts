/**
 * External Linker — Sprint C
 *
 * Injects authoritative external links into article HTML.
 * Source map is curated per niche (§4.9).
 *
 * All injected links carry rel="nofollow noopener noreferrer".
 * Injection point: H2 with most word-overlap to source topic,
 * appended after the second paragraph in that section.
 *
 * Spec reference: §4.9
 */

// ---------------------------------------------------------------------------
// Authority source map
// ---------------------------------------------------------------------------

interface AuthoritySource {
  name: string
  url: string
  topic: string
}

const NICHE_AUTHORITY_SOURCES: Record<string, AuthoritySource[]> = {
  woodworking: [
    { name: 'The Wood Database', url: 'https://www.wood-database.com/', topic: 'wood species lumber properties' },
    { name: 'Fine Woodworking', url: 'https://www.finewoodworking.com/', topic: 'woodworking techniques projects' },
    { name: 'USDA Forest Service', url: 'https://www.fs.usda.gov/', topic: 'forest wood resources sustainability' },
  ],
  gardening: [
    { name: 'Royal Horticultural Society', url: 'https://www.rhs.org.uk/', topic: 'gardening plants growing advice' },
    { name: 'Old Farmer\'s Almanac', url: 'https://www.almanac.com/', topic: 'planting calendar growing tips' },
    { name: 'USDA Plant Database', url: 'https://plants.usda.gov/', topic: 'plant species identification native plants' },
  ],
  fishing: [
    { name: 'Take Me Fishing', url: 'https://www.takemefishing.org/', topic: 'fishing techniques regulations license' },
    { name: 'US Fish & Wildlife Service', url: 'https://www.fws.gov/', topic: 'fish wildlife conservation' },
    { name: 'In-Fisherman', url: 'https://www.in-fisherman.com/', topic: 'fishing tips species guide' },
  ],
  quilting: [
    { name: 'American Quilter\'s Society', url: 'https://www.americanquilter.com/', topic: 'quilting patterns techniques' },
    { name: 'Quilt Alliance', url: 'https://www.quiltalliance.org/', topic: 'quilt history preservation' },
  ],
  bird_watching: [
    { name: 'Cornell Lab of Ornithology', url: 'https://www.allaboutbirds.org/', topic: 'bird identification species guide' },
    { name: 'Audubon Society', url: 'https://www.audubon.org/', topic: 'bird conservation habitat' },
  ],
  birding: [
    { name: 'Cornell Lab of Ornithology', url: 'https://www.allaboutbirds.org/', topic: 'bird identification species guide' },
    { name: 'Audubon Society', url: 'https://www.audubon.org/', topic: 'bird conservation habitat' },
  ],
  genealogy: [
    { name: 'FamilySearch', url: 'https://www.familysearch.org/', topic: 'genealogy records family history research' },
    { name: "Cyndi's List", url: 'https://www.cyndislist.com/', topic: 'genealogy resources databases' },
  ],
  'ham-radio': [
    { name: 'ARRL — The National Association for Amateur Radio', url: 'https://www.arrl.org/', topic: 'amateur radio licensing handbook' },
    { name: 'FCC Amateur Radio Service', url: 'https://www.fcc.gov/amateur-radio-service', topic: 'amateur radio regulations license' },
  ],
  'rv-living': [
    { name: 'RV Industry Association', url: 'https://www.rvia.org/', topic: 'rv industry standards safety' },
    { name: 'Good Sam', url: 'https://www.goodsam.com/', topic: 'rv camping parks travel tips' },
  ],
  watercolor: [
    { name: 'Artists Network', url: 'https://www.artistsnetwork.com/', topic: 'watercolor painting techniques tutorials' },
    { name: 'Winsor & Newton', url: 'https://www.winsornewton.com/', topic: 'watercolor paints materials guide' },
  ],
  canning: [
    { name: 'National Center for Home Food Preservation', url: 'https://nchfp.uga.edu/', topic: 'food preservation canning safety' },
    { name: 'Ball Canning', url: 'https://www.ballmasonjars.com/', topic: 'canning recipes equipment instructions' },
  ],
  model_trains: [
    { name: 'NMRA — National Model Railroad Association', url: 'https://www.nmra.org/', topic: 'model railroad standards scale guide' },
    { name: 'Model Railroader Magazine', url: 'https://www.trains.com/mrr/', topic: 'model train layouts reviews' },
  ],
  knitting: [
    { name: 'Ravelry', url: 'https://www.ravelry.com/', topic: 'knitting patterns yarn community' },
    { name: 'Craft Yarn Council', url: 'https://www.craftyarncouncil.com/', topic: 'knitting standards yarn weight guide' },
  ],
  astronomy: [
    { name: 'NASA', url: 'https://www.nasa.gov/', topic: 'astronomy space science research' },
    { name: 'Sky & Telescope', url: 'https://skyandtelescope.org/', topic: 'astronomy observing telescope guide' },
  ],
  aquarium: [
    { name: 'Aquarium Science', url: 'https://www.aquariumscience.org/', topic: 'aquarium filtration fish care' },
    { name: 'Tropical Fish Hobbyist', url: 'https://www.tfhmagazine.com/', topic: 'aquarium fish species care guide' },
  ],
  beekeeping: [
    { name: 'American Beekeeping Federation', url: 'https://www.abfnet.org/', topic: 'beekeeping standards education' },
    { name: 'USDA Bees & Pollination', url: 'https://www.ars.usda.gov/', topic: 'bee research pollination science' },
  ],
  hiking: [
    { name: 'American Hiking Society', url: 'https://americanhiking.org/', topic: 'hiking trails conservation stewardship' },
    { name: 'REI Expert Advice', url: 'https://www.rei.com/learn/expert-advice', topic: 'hiking gear skills beginner guide' },
  ],
  photography: [
    { name: 'Digital Photography Review', url: 'https://www.dpreview.com/', topic: 'camera reviews photography techniques' },
    { name: 'Photography Life', url: 'https://photographylife.com/', topic: 'photography tutorial settings guide' },
  ],
  chess: [
    { name: 'Chess.com', url: 'https://www.chess.com/', topic: 'chess strategy openings tactics' },
    { name: 'Lichess', url: 'https://lichess.org/', topic: 'chess tools analysis puzzles' },
  ],
  health: [
    { name: 'Mayo Clinic', url: 'https://www.mayoclinic.org/', topic: 'health medical information symptoms' },
    { name: 'Healthline', url: 'https://www.healthline.com/', topic: 'health wellness nutrition evidence' },
  ],
  wealth: [
    { name: 'NerdWallet', url: 'https://www.nerdwallet.com/', topic: 'personal finance investing budgeting' },
    { name: 'Investopedia', url: 'https://www.investopedia.com/', topic: 'investing financial terms education' },
  ],
  software: [
    { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', topic: 'web development programming documentation' },
    { name: 'GitHub', url: 'https://github.com/', topic: 'software code repository open source' },
  ],
  survival: [
    { name: 'FEMA', url: 'https://www.fema.gov/', topic: 'emergency preparedness disaster response' },
    { name: 'American Red Cross', url: 'https://www.redcross.org/', topic: 'emergency preparedness first aid training' },
  ],
}

// Generic fallback sources
const GENERIC_SOURCES: AuthoritySource[] = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/', topic: 'general reference information' },
  { name: 'USA.gov', url: 'https://www.usa.gov/', topic: 'government resources official information' },
]

// ---------------------------------------------------------------------------
// Word-overlap scoring for H2 matching
// ---------------------------------------------------------------------------

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }
  return overlap
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Inject 1–2 authoritative external links into article HTML. */
export function injectExternalLinks(html: string, niche: string): string {
  const sources = NICHE_AUTHORITY_SOURCES[niche] ?? GENERIC_SOURCES

  if (sources.length === 0) return html

  // Parse H2 headings from HTML
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  const headings: { text: string; raw: string }[] = []
  let m: RegExpExecArray | null
  while ((m = h2Pattern.exec(html)) !== null) {
    headings.push({ text: m[1].replace(/<[^>]+>/g, '').trim(), raw: m[0] })
  }

  let result = html

  // Inject up to 2 sources
  for (const source of sources.slice(0, 2)) {
    // Find H2 with most word overlap to this source's topic
    let bestHeading = headings[0]?.raw ?? ''
    let bestScore = -1
    for (const heading of headings) {
      const score = wordOverlap(heading.text, source.topic)
      if (score > bestScore) {
        bestScore = score
        bestHeading = heading.raw
      }
    }

    const link =
      `<a href="${source.url}" ` +
      `rel="nofollow noopener noreferrer" ` +
      `target="_blank">${source.name}</a>`

    const citationParagraph = `<p>For authoritative information on this topic, see ${link}.</p>`

    if (bestHeading && result.includes(bestHeading)) {
      // Inject after the second paragraph following this H2
      const headingIdx = result.indexOf(bestHeading)
      const afterHeading = result.slice(headingIdx + bestHeading.length)
      let pCount = 0
      let insertIdx = -1
      for (let i = 0; i < afterHeading.length - 4; i++) {
        if (afterHeading.slice(i, i + 4) === '</p>') {
          pCount++
          if (pCount === 2) {
            insertIdx = i + 4
            break
          }
        }
      }
      if (insertIdx >= 0) {
        result =
          result.slice(0, headingIdx + bestHeading.length) +
          afterHeading.slice(0, insertIdx) +
          '\n' +
          citationParagraph +
          afterHeading.slice(insertIdx)
      } else {
        // No second paragraph found — append after H2 directly
        result = result.replace(bestHeading, bestHeading + '\n' + citationParagraph)
      }
    } else {
      // No H2 found — append before </body> or at end
      if (result.includes('</body>')) {
        result = result.replace('</body>', citationParagraph + '\n</body>')
      } else {
        result += '\n' + citationParagraph
      }
    }
  }

  return result
}
