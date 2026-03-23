/**
 * Test semantic search — run natural language queries against pgvector
 *
 * Usage: npx tsx scripts/test_semantic_search.ts "something to clean my floors"
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${EMBED_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embed error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.embedding?.values;
}

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.log('Usage: npx tsx scripts/test_semantic_search.ts "your search query"');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get a building ID
  const { data: building } = await supabase
    .from('buildings')
    .select('id')
    .single();

  console.log(`Query: "${query}"`);
  console.log('Generating embedding...');

  const embedding = await embedText(query);
  console.log(`Embedding: ${embedding.length} dims`);

  console.log('Searching...\n');

  const { data: results, error } = await supabase.rpc('search_items_by_image', {
    query_embedding: JSON.stringify(embedding),
    search_building_id: building?.id,
    match_threshold: 0.3,
    match_count: 10,
  });

  if (error) {
    console.error('Search error:', error);
    process.exit(1);
  }

  if (!results || results.length === 0) {
    console.log('No results found.');
  } else {
    console.log(`Found ${results.length} results:`);
    results.forEach((r: any, i: number) =>
      console.log(`  ${i + 1}. ${r.similarity.toFixed(3)} — ${r.title}`)
    );
  }
}

main();
