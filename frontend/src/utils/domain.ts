// Deteksi wajah aplikasi berdasarkan hostname:
//  - office.*                     → BACK OFFICE (staf): langsung ke login/manajemen
//  - reformeryourbody.com (apex)  → PUBLIK: landing page + login/daftar member
//  - localhost/lainnya            → office (agar pengembangan lancar)
export const IS_OFFICE = (() => {
  const h = window.location.hostname
  if (h.startsWith('office.')) return true
  if (h === 'reformeryourbody.com' || h === 'www.reformeryourbody.com') return false
  return true
})()
