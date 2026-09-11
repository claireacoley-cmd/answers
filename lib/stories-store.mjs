// Blobs access for the private Story Bank. Only auth-only functions import this. Never the public blog.
import { getStore } from '@netlify/blobs';
import { STORIES_SEED, STORY_LEADS_NOTE } from './stories-seed.mjs';

const store = () => getStore({ name: 'stories', consistency: 'strong' });
export async function loadStories() {
  let doc = await store().get('list', { type: 'json' });
  if (!doc) {
    doc = { version: 1, items: STORIES_SEED.map((s) => ({ ...s })), nextId: STORIES_SEED.length + 1, matches: {}, note: STORY_LEADS_NOTE };
    await store().setJSON('list', doc);
  }
  doc.matches ||= {};
  return doc;
}
export const saveStories = (doc) => store().setJSON('list', doc);
