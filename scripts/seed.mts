// npm run db:seed
//
// Adds 12 sample notes (with tags) for the demo owner. SAFE TO RUN TWICE:
// every note has a fixed id and every insert says ON CONFLICT ... DO
// NOTHING, so a second run finds everything already there and adds nothing.
// It never overwrites a sample note you have edited.
//
// Everything happens in ONE transaction: if any insert fails, none of the
// sample data is left behind half-made.
//
// Run `npm run db:migrate` first: the seed needs the tables.

import { neonConfig, Pool } from '@neondatabase/serverless'

neonConfig.webSocketConstructor = WebSocket

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.')
  process.exit(1)
}

// Must match DEMO_OWNER_ID in lib/owner.ts. (Scripts run outside Next.js,
// and lib/owner.ts is server-only, so the value is repeated here.)
const DEMO_OWNER_ID = '00000000-0000-4000-8000-000000000016'

type SeedNote = {
  n: number
  title: string
  body: string
  tags: string[]
  /** How long ago it was last edited, in hours: gives the list a real order. */
  hoursAgo: number
  pinned?: boolean
  archived?: boolean
  trashed?: boolean
}

const notes: SeedNote[] = [
  {
    n: 1,
    title: 'Market list for Saturday (Bodija)',
    pinned: true,
    hoursAgo: 3,
    tags: ['shopping', 'market'],
    body: `Go early, before 8am, when the tomatoes are fresh.

- Tomatoes: 1 small basket (check the bottom ones)
- Tatashe and rodo for the stew
- Onions: 1 paint bucket
- Ugu and shoko leaves
- Crayfish and stockfish (Iya Bisi's stall, she gives jara)
- Palm oil: 2 litres
- Ofada rice: 1 mudu
- Plantain: 1 bunch, half ripe

Budget: ₦45,000. Bring small notes for the alaroro.`,
  },
  {
    n: 2,
    title: 'JAMB Physics: formulas to remember',
    pinned: true,
    hoursAgo: 20,
    tags: ['jamb', 'study', 'physics'],
    body: `Motion
- v = u + at
- s = ut + ½at²
- v² = u² + 2as

Waves
- v = fλ
- Period T = 1/f

Electricity
- V = IR
- Power P = IV = I²R
- Resistors in series add up; in parallel, add the reciprocals.

Past questions: do 2015–2019 this week. Time myself: 40 questions in 30 minutes.`,
  },
  {
    n: 3,
    title: 'Jollof rice for 10 people (party size)',
    hoursAgo: 30,
    tags: ['recipe', 'food'],
    body: `Party jollof, smoky bottom pot style.

Ingredients
- 1.5kg long grain parboiled rice
- 8 tatashe, 4 tomatoes, 3 rodo, 2 onions (blend, then boil down until thick)
- 1 tin tomato paste, fried well in oil
- Thyme, curry powder, bay leaves, 3 stock cubes
- Chicken stock from boiling the chicken

Method
1. Fry the paste until it darkens, add the blended pepper, cook for 25 minutes.
2. Add stock and seasoning, then the washed rice.
3. Cover with foil and the lid; cook on low heat.
4. Don't stir too much. Let the bottom catch a little for the party flavour.`,
  },
  {
    n: 4,
    title: 'Ẹ̀fọ́ riro the way Mama makes it',
    hoursAgo: 52,
    tags: ['recipe', 'food'],
    body: `Mama says the secret is not to overcook the ẹ̀fọ́.

- Wash and squeeze the spinach (ẹ̀fọ́ tẹ̀tẹ̀) and set aside
- Blend tatashe, rodo and onion coarsely, boil off the water
- Palm oil in the pot, fry the iru (locust beans) and onion first
- Add the pepper, then assorted meat, stockfish and ponmo
- Crayfish and seasoning, 10 minutes
- Ẹ̀fọ́ last, stir, 3 minutes, done

Serve with pounded yam or ẹ̀bà.`,
  },
  {
    n: 5,
    title: 'Use of English: lexis and structure tips',
    hoursAgo: 75,
    tags: ['jamb', 'study'],
    body: `- Read the whole sentence before choosing. The clue is often at the end.
- "Each" and "every" take singular verbs.
- Opposites (antonyms): watch for prefixes like un-, in-, dis-.
- Idioms to revise: "a storm in a teacup", "to bury the hatchet", "at sixes and sevens".
- Comprehension: read the questions FIRST, then the passage.

The novel this year: read two chapters every night.`,
  },
  {
    n: 6,
    title: 'Tuesday standup',
    hoursAgo: 98,
    tags: ['work', 'meeting'],
    body: `Present: Ada, Emeka, Kunle, me

- Payments page: Emeka is fixing the double-charge bug, needs one more day
- Ada: onboarding screens are ready for review
- Me: finish the search filters, then pair with Kunle on caching
- Blocker: staging database is slow in the mornings. Ask DevOps about it.

Next demo: Friday 2pm.`,
  },
  {
    n: 7,
    title: 'Estate meeting: gate and security levy',
    hoursAgo: 140,
    tags: ['meeting', 'home'],
    body: `Residents' meeting, Saturday 10am at the clubhouse.

- New gate times: closes 11pm, opens 5am
- Security levy goes up to ₦7,500 per month from next quarter
- Street lights: two on Close B are out; the chairman will call the electrician
- Drainage before the rains: every household contributes ₦5,000

Action: pay the levy by the 15th, and remind Mr Okafor about his dog.`,
  },
  {
    n: 8,
    title: 'App ideas',
    hoursAgo: 190,
    tags: ['ideas'],
    body: `- Danfo route finder for Lagos: which bus, which park, roughly how much
- Ajo / esusu tracker for a savings group, with reminders on WhatsApp
- A JAMB past-questions app that works offline
- Price checker for market items, updated by buyers
- This notes app, but with sharing (later!)`,
  },
  {
    n: 9,
    title: 'Books to read this year',
    hoursAgo: 260,
    tags: ['reading'],
    body: `- Things Fall Apart (reread): Chinua Achebe
- Half of a Yellow Sun: Chimamanda Ngozi Adichie
- The Famished Road: Ben Okri
- Stay With Me: Ayọ̀bámi Adébáyọ̀
- My Sister, the Serial Killer: Oyinkan Braithwaite

One book a month. Borrow from the library first.`,
  },
  {
    n: 10,
    title: 'Generator servicing log',
    hoursAgo: 340,
    tags: ['home'],
    body: `- 3 Mar: oil change and new plug (₦12,000)
- 18 Apr: carburettor cleaned, it was cutting off
- 2 Jun: oil change, air filter
- Next service: early August, or after 100 hours of running

Mechanic: Baba Tunde, behind the filling station.`,
  },
  {
    n: 11,
    title: "Gift ideas for Tolu's wedding",
    archived: true,
    hoursAgo: 900,
    tags: ['ideas', 'shopping'],
    body: `Done: we bought the blender in the end.

- Blender or food processor
- Aso-ebi for the day (ordered from Mrs Adeyemi)
- Framed photo of the two of them from the introduction`,
  },
  {
    n: 12,
    title: 'Old to-do list',
    trashed: true,
    hoursAgo: 1200,
    tags: ['home'],
    body: `- Renew driver's licence
- Fix the kitchen tap
- Call the landlord about the roof`,
  },
]

/** Fixed, valid UUIDs so the seed can recognise its own notes on a second run. */
const noteId = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`

const pool = new Pool({ connectionString })
const client = await pool.connect()

try {
  await client.query('BEGIN')
  let insertedNotes = 0
  let insertedLinks = 0

  for (const note of notes) {
    // timestamps are given explicitly so the sample notes have a realistic
    // history. (On INSERT, the updated_at trigger doesn't run: it is a
    // BEFORE UPDATE trigger.) make_interval builds "N hours" from a parameter.
    const result = await client.query(
      `INSERT INTO notes (id, owner_id, title, body, pinned, archived, deleted_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $7::boolean THEN now() - make_interval(hours => $8::int / 2) END,
               now() - make_interval(hours => $8::int * 2),
               now() - make_interval(hours => $8::int))
       ON CONFLICT (id) DO NOTHING`,
      [noteId(note.n), DEMO_OWNER_ID, note.title, note.body, note.pinned ?? false, note.archived ?? false, note.trashed ?? false, note.hoursAgo],
    )
    insertedNotes += result.rowCount ?? 0

    await client.query(
      `INSERT INTO tags (owner_id, name) SELECT $1, unnest($2::text[])
       ON CONFLICT (owner_id, name) DO NOTHING`,
      [DEMO_OWNER_ID, note.tags],
    )
    const links = await client.query(
      `INSERT INTO note_tags (note_id, tag_id)
       SELECT $1, id FROM tags WHERE owner_id = $2 AND name = ANY($3::text[])
       ON CONFLICT DO NOTHING`,
      [noteId(note.n), DEMO_OWNER_ID, note.tags],
    )
    insertedLinks += links.rowCount ?? 0
  }

  await client.query('COMMIT')
  console.log(
    insertedNotes === 0
      ? 'Seed data is already there. Nothing added.'
      : `Seeded ${insertedNotes} note(s) and ${insertedLinks} tag link(s) for the demo owner.`,
  )
} catch (error) {
  await client.query('ROLLBACK')
  console.error('Seeding failed and was rolled back.')
  throw error
} finally {
  client.release()
  await pool.end()
}
