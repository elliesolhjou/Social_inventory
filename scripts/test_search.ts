import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Check how many items are embedded
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .not('image_embedding', 'is', null);

  console.log('Items with embeddings:', count);

  // Grab one embedded item and search with its own vector
  const { data: item } = await supabase
    .from('items')
    .select('id, title, building_id, image_embedding')
    .not('image_embedding', 'is', null)
    .limit(1)
    .single();

  console.log('Searching with:', item.title);

  const { data: results, error } = await supabase.rpc('search_items_by_image', {
    query_embedding: item.image_embedding,
    search_building_id: item.building_id,
    match_threshold: 0.3,
    match_count: 10,
  });

  if (error) {
    console.error('Search error:', error);
  } else {
    console.log('Found', results.length, 'results:');
    results.forEach((r) =>
      console.log('  ', r.similarity.toFixed(3), '—', r.title)
    );
  }
}

main();
