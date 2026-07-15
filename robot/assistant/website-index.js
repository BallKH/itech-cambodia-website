// iTech Cambodia — AI website assistant — knowledge index loader
// Loads assets/website-index.json (produced by
// scripts/build_website_index.py from the live page HTML — see that file's
// header for how to regenerate it after content changes) and caches it in
// memory for the life of the page. Every other assistant module reads the
// index only through getIndex() — none of them know it came from a JSON
// file on disk.

const INDEX_URL = "assets/website-index.json?v=1";

let cached = null;
let loading = null;

export async function getIndex() {
  if (cached) return cached;
  if (!loading) {
    loading = fetch(INDEX_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`website-index.json ${res.status}`);
        return res.json();
      })
      .then((data) => {
        cached = data;
        return data;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}
