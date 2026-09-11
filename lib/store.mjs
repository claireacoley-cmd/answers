// Persistence on Netlify Blobs. Three stores: posts, templates, settings.
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_TEMPLATES } from './default-templates.mjs';

const opts = { consistency: 'strong' };

export const posts = () => getStore({ name: 'posts', ...opts });
export const templates = () => getStore({ name: 'templates', ...opts });
export const settings = () => getStore({ name: 'settings', ...opts });

export function newId() {
  return randomUUID();
}

// ---------- Posts ----------
export function blankPost(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title: '',
    slug: '',
    body: '',
    status: 'draft', // draft | published
    metaDescription: '',
    tags: [],
    coverImage: '',
    coverAlt: '',
    canonical: '',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    offpage: {}, // { checklistKey: true }
    ...overrides,
  };
}

export async function listPosts() {
  const store = posts();
  const { blobs } = await store.list();
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  return all
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getPost(id) {
  return posts().get(id, { type: 'json' });
}

export async function savePost(post) {
  post.updatedAt = new Date().toISOString();
  await posts().setJSON(post.id, post);
  return post;
}

export async function deletePost(id) {
  await posts().delete(id);
}

export async function listPublished() {
  const all = await listPosts();
  return all
    .filter((p) => p.status === 'published')
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

export async function getPublishedBySlug(slug) {
  const all = await listPublished();
  return all.find((p) => p.slug === slug) || null;
}

export async function slugExists(slug, exceptId) {
  const all = await listPosts();
  return all.some((p) => p.slug === slug && p.id !== exceptId);
}

// ---------- Templates ----------
export async function listTemplates() {
  const store = templates();
  const { blobs } = await store.list();
  if (blobs.length === 0) {
    // seed defaults on first run
    for (const t of DEFAULT_TEMPLATES) await store.setJSON(t.id, t);
    return DEFAULT_TEMPLATES.slice();
  }
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  return all.filter(Boolean).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}

export async function saveTemplate(t) {
  if (!t.id) t.id = newId();
  t.updatedAt = new Date().toISOString();
  await templates().setJSON(t.id, t);
  return t;
}

export async function deleteTemplate(id) {
  await templates().delete(id);
}

// ---------- Settings ----------
export const DEFAULT_SETTINGS = {
  siteName: 'Claire Coley',
  blogTitle: 'Answers',
  blogTagline: 'Short, direct answers from Claire Coley.',
  authorName: 'Claire Coley',
  authorBio: '',
  authorUrl: '',
  authorImage: '',
  sameAs: [], // social profile URLs
  organisation: '',
  language: 'en-GB',
  minWords: 500,
  accentColour: '#A50D18',
  footerText: '',
};

export async function getSettings() {
  const s = await settings().get('site', { type: 'json' });
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(s) {
  const merged = { ...DEFAULT_SETTINGS, ...s };
  await settings().setJSON('site', merged);
  return merged;
}
