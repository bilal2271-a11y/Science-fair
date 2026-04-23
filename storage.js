// ============================================================================
// STORAGE ABSTRACTION
// ----------------------------------------------------------------------------
// Two storage scopes exist:
//
//   • Local   — always browser localStorage. Used for per-device state like
//               the anonymous voter ID. Never synced anywhere.
//
//   • Shared  — the project roster and the vote log. Synced across devices
//               IF Supabase env vars are set; otherwise falls back to
//               localStorage (single-device only, NOT suitable for an
//               actual fair — see README).
//
// To flip on real cross-device sync:
//   1. Create a free Supabase project.
//   2. Run the SQL in README.md to create the `kv` table.
//   3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.
//   4. Restart the dev server / redeploy.
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let _sbPromise = null;
async function getSb() {
  if (!useSupabase) return null;
  if (!_sbPromise) {
    _sbPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY))
      .catch((e) => {
        console.warn('[storage] supabase-js failed to load, falling back to localStorage.', e);
        return null;
      });
  }
  return _sbPromise;
}

// ----- Local scope (always localStorage) -----
function getLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setLocal(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

// ----- Shared scope -----
async function getShared(key) {
  const sb = await getSb();
  if (sb) {
    const { data, error } = await sb.from('kv').select('value').eq('key', key).maybeSingle();
    if (error) {
      console.warn('[storage.getShared]', error.message);
      return null;
    }
    return data?.value ?? null;
  }
  return getLocal('shared:' + key);
}

async function setShared(key, value) {
  const sb = await getSb();
  if (sb) {
    const { error } = await sb.from('kv').upsert({ key, value }, { onConflict: 'key' });
    if (error) {
      console.warn('[storage.setShared]', error.message);
      return false;
    }
    return true;
  }
  return setLocal('shared:' + key, value);
}

// Subscribe to changes on shared state.
// Returns an unsubscribe function.
async function subscribeShared(onChange) {
  const sb = await getSb();
  if (sb) {
    const channel = sb
      .channel('scifair-kv-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kv' },
        (payload) => onChange(payload),
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }
  // localStorage "storage" event fires only in OTHER tabs of the same origin.
  // Useful for demoing multi-tab voting on one machine.
  const handler = (e) => {
    if (e.key && e.key.startsWith('shared:')) onChange({ key: e.key });
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export const storage = {
  isLive: useSupabase,
  backend: useSupabase ? 'supabase' : 'localStorage',
  getLocal,
  setLocal,
  getShared,
  setShared,
  subscribeShared,
};
