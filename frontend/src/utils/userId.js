const KEY = 'armadio_user_id'

function generateUUID() {
  // crypto.randomUUID() richiede HTTPS — fallback compatibile con HTTP locale
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID() } catch (_) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto?.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(1))[0]
      : Math.random() * 256) & 15
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function getUserId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = generateUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
