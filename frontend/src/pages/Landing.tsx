import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import Brand from '@/components/Brand'
import { formatRupiah } from '@/utils/format'
import {
  Infinity as InfinityIcon, Sparkles, HeartPulse, Wind, Users2, Star, Clock,
  MapPin, Phone, ArrowRight, Menu, Building2, ChevronDown, MessageCircle,
} from 'lucide-react'

interface StudioInfo { name: string; tagline?: string | null; address?: string | null; phone?: string | null; media?: Record<string, string> }
interface Pkg { id: string; name: string; description?: string | null; is_unlimited: boolean; session_count?: number | null; price: number }
interface BranchInfo { id: string; name: string; address?: string | null; phone?: string | null }
interface Stats { members_active: number; branches: number; capacity: number; sessions_done: number }

// Angka besar dibulatkan ke bawah + "+" (mis. 312 → "310+"); kecil ditampilkan apa adanya
const nf = (n?: number) => (n == null ? '…' : n < 10 ? String(n) : `${Math.floor(n / 10) * 10}+`)

const CLASSES = [
  { slot: 'class1', icon: Wind, title: 'Reformer Flow', level: 'Semua level', desc: 'Gerakan mengalir di atas reformer untuk kekuatan inti, mobilitas, dan postur.', grad: 'from-[#e9c9b4] to-[#cf9880]' },
  { slot: 'class2', icon: HeartPulse, title: 'Reformer Basic', level: 'Pemula', desc: 'Kelas fondasi untuk pemula — kenali mesin, napas, dan prinsip pilates dengan tenang.', grad: 'from-[#f0d5c4] to-[#d99e86]' },
  { slot: 'class3', icon: Users2, title: 'Private Session', level: 'Personal', desc: 'Sesi privat satu-satu bersama instruktur, disesuaikan dengan tubuh & tujuanmu.', grad: 'from-[#e5bfa8] to-[#b9744f]' },
]

const WHY = [
  { title: 'Postur & keseimbangan', desc: 'Gerakan terkontrol yang memperbaiki postur dan kesadaran tubuh setiap harinya.' },
  { title: 'Kekuatan tanpa beban berat', desc: 'Bangun otot inti yang stabil lewat resistensi lembut per pegas reformer.' },
  { title: 'Kelas kecil & personal', desc: 'Kapasitas terbatas agar setiap gerakanmu diperhatikan instruktur.' },
]

const STEPS = [
  { title: 'Daftar member', desc: 'Buat akun dengan nomor HP-mu & pilih paket. Cukup sekali.' },
  { title: 'Pilih jadwal via web', desc: 'Lihat jadwal minggu ini, cek sisa slot, dan booking kelas favoritmu sendiri.' },
  { title: 'Datang & bergerak', desc: 'Tiba 10 menit lebih awal, sisa kuota otomatis terpotong. Selesai!' },
]

const TESTIMONIALS = [
  { name: 'Sasya A.', tag: 'Member sejak 2024', text: 'Postur aku jauh membaik setelah 2 bulan. Instrukturnya sabar banget buat pemula.' },
  { name: 'Nita R.', tag: 'Paket Unlimited', text: 'Kelas kecil jadi tiap gerakan diperhatiin. Booking lewat web-nya juga gampang.' },
  { name: 'Dwi W.', tag: 'Member sejak 2023', text: 'Awalnya cuma coba drop-in, sekarang malah ketagihan. Badan lebih kuat & rileks.' },
]

const FAQ = [
  { q: 'Saya belum pernah pilates — boleh ikut?', a: 'Sangat boleh. Mulai dari kelas Reformer Basic — dirancang khusus untuk pemula. Instruktur akan memandu napas, posisi, dan penggunaan mesin dari nol.' },
  { q: 'Apa yang perlu saya bawa?', a: 'Cukup pakaian olahraga yang nyaman dan kaus kaki anti-selip (grip socks). Handuk kecil dan air minum disarankan. Matras & alat sudah disediakan studio.' },
  { q: 'Bisa reschedule atau batalkan kelas?', a: 'Bisa. Batalkan atau ganti jadwal sendiri lewat web selama lebih dari 12 jam sebelum kelas mulai — kuota sesimu tidak berkurang. Di bawah 12 jam, jadwal terkunci.' },
  { q: 'Seberapa besar kelasnya?', a: 'Maksimal 14 peserta per kelas agar setiap gerakanmu tetap diperhatikan instruktur. Untuk perhatian penuh satu-satu, pilih Private Session.' },
  { q: 'Paket saya berlaku berapa lama?', a: 'Paket 10 sesi berlaku 2 bulan, Unlimited berlaku per bulan. Sisa kuota & masa berlaku bisa kamu pantau kapan saja dari akun member-mu.' },
]

// Motif garis diagonal halus untuk placeholder foto
const LINES = { backgroundImage: 'repeating-linear-gradient(118deg,transparent 0 40px,rgba(255,255,255,.14) 40px 41px)' }

function waLink(phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return '#'
  const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('62') ? digits : '62' + digits
  return `https://wa.me/${intl}`
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { data: studio } = useQuery({ queryKey: ['public-studio'], queryFn: async () => (await api.get<StudioInfo>('/public/studio')).data })
  const { data: packages } = useQuery({ queryKey: ['public-packages'], queryFn: async () => (await api.get<Pkg[]>('/public/packages')).data })
  const { data: branches } = useQuery({ queryKey: ['public-branches'], queryFn: async () => (await api.get<BranchInfo[]>('/public/branches')).data })
  const { data: stats } = useQuery({ queryKey: ['public-stats'], queryFn: async () => (await api.get<Stats>('/public/stats')).data })

  const name = studio?.name ?? 'Reformer Your Body'
  const media = studio?.media ?? {}
  const wa = waLink(studio?.phone)

  const navLinks = [['#kelas', 'Kelas'], ['#cara', 'Cara mulai'], ['#paket', 'Paket'], ['#faq', 'FAQ'], ['#kontak', 'Kontak']]

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* NAV — transparan di atas hero, solid saat di-scroll */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ${scrolled ? 'bg-cream/90 backdrop-blur border-b border-sand' : 'bg-transparent'}`}>
        <div className="mx-auto max-w-6xl px-5 h-[70px] flex items-center justify-between">
          <a href="#top" className={scrolled ? '' : 'brightness-0 invert'}><Brand size="sm" imgClassName="!h-9" showName /></a>
          <nav className={`hidden md:flex items-center gap-8 text-sm font-medium transition-colors ${scrolled ? 'text-ink/70' : 'text-white/90'}`}>
            {navLinks.map(([href, label]) => <a key={href} href={href} className="hover:opacity-70">{label}</a>)}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="btn-primary !px-5">Masuk</Link>
          </div>
          <button className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-ink' : 'text-white'}`} onClick={() => setMenuOpen((v) => !v)}><Menu size={22} /></button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-sand bg-cream px-5 py-4 flex flex-col gap-3">
            {navLinks.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-ink/70">{label}</a>)}
            <Link to="/login" className="btn-primary" onClick={() => setMenuOpen(false)}>Masuk</Link>
          </div>
        )}
      </header>

      {/* HERO full-bleed */}
      <section id="top" className="relative min-h-[92vh] flex items-center justify-center text-center px-6 pt-28 pb-24 overflow-hidden">
        {media.hero ? (
          <img src={media.hero} alt="Suasana studio" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#d9b49c] via-[#bd7a61] to-[#8a5140]"><div className="absolute inset-0 opacity-40" style={LINES} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2a211c]/45 via-[#2a211c]/20 to-[#2a211c]/60" />
        {!media.hero && (
          <span className="absolute left-5 bottom-5 z-10 inline-flex items-center gap-1.5 bg-[#2a211c]/50 text-white/90 text-[11px] px-3 py-1.5 rounded-full backdrop-blur">
            Foto suasana studio — atur di Pengaturan
          </span>
        )}
        <div className="relative z-10 max-w-3xl text-white">
          <span className="inline-flex items-center gap-2 bg-white/15 border border-white/30 text-white text-xs font-semibold tracking-wide px-4 py-1.5 rounded-full backdrop-blur">
            <Sparkles size={14} /> Studio Pilates Reformer
          </span>
          <h1 className="font-display font-semibold leading-[1.03] mt-6 text-[clamp(2.6rem,7vw,4.7rem)] [text-wrap:balance] drop-shadow">
            {studio?.tagline ?? 'Bergerak dengan niat, seimbang & kuat.'}
          </h1>
          <p className="text-white/90 text-lg mt-5 max-w-xl mx-auto">
            Kelas reformer kecil & personal — bangun kekuatan inti, perbaiki postur, dan temukan ketenangan bersama instruktur bersertifikat.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Link to="/register" className="btn-primary text-base !px-6 !py-3">Coba kelas trial <ArrowRight size={18} /></Link>
            <a href="#paket" className="btn text-base !px-6 !py-3 bg-white/15 text-white border border-white/40 backdrop-blur hover:bg-white/25">Lihat paket</a>
          </div>
          <div className="flex items-center justify-center gap-3 mt-9">
            <div className="flex">
              {['SA', 'NI', 'RA', 'DW'].map((i, n) => (
                <span key={i} className="w-9 h-9 rounded-full border-[2.5px] border-white/80 grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-[#e9c9b4] to-[#bd7a61]" style={{ marginLeft: n ? -12 : 0 }}>{i}</span>
              ))}
            </div>
            <div className="text-left">
              <div className="flex gap-0.5 text-[#F3D9A6]">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} fill="currentColor" stroke="none" />)}</div>
              <small className="block text-white/80 text-[13px]"><b className="text-white">{nf(stats?.members_active)} member aktif</b> berlatih bersama kami</small>
            </div>
          </div>
        </div>
        <a href="#kenapa" className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 text-white/75 animate-bounce"><ChevronDown size={24} /></a>
      </section>

      {/* PITA STATISTIK — angka nyata dari database */}
      <div className="bg-sand border-b border-sand">
        <div className="mx-auto max-w-6xl px-5 grid grid-cols-2 sm:grid-cols-4 gap-6 py-7 text-center">
          {[
            [nf(stats?.members_active), 'Member aktif'],
            [stats ? String(stats.branches) : '…', 'Cabang studio'],
            [stats ? `maks ${stats.capacity}` : '…', 'Peserta / kelas'],
            [nf(stats?.sessions_done), 'Sesi terlaksana'],
          ].map(([n, l]) => (
            <div key={l}><div className="font-display text-3xl font-semibold text-copper-700 tabular-nums">{n}</div><div className="text-[13px] text-ink/60 mt-0.5">{l}</div></div>
          ))}
        </div>
      </div>

      {/* KENAPA */}
      <section id="kenapa" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-600">Kenapa reformer</span>
            <h2 className="font-display text-4xl font-semibold mt-3 leading-tight">Latihan lembut, hasil yang terasa.</h2>
            <div className="mt-6">
              {WHY.map((w, i) => (
                <div key={w.title} className="flex gap-5 py-6 border-b border-sand last:border-0">
                  <div className="font-display text-copper-600 font-semibold">0{i + 1}</div>
                  <div><h3 className="font-semibold text-lg">{w.title}</h3><p className="text-ink/60 text-[15px] mt-1.5">{w.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-square rounded-[26px] overflow-hidden border border-copper-200 shadow-card">
            {media.about ? (
              <img src={media.about} alt="Kelas pilates" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-sand via-copper-200 to-[#cf9880]">
                <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'repeating-linear-gradient(60deg,transparent 0 30px,rgba(255,255,255,.16) 30px 31px)' }} />
                <span className="absolute right-4 top-4 bg-[#2a211c]/40 text-white text-[11px] px-3 py-1 rounded-full backdrop-blur">Foto instruktur / kelas</span>
              </div>
            )}
            <div className="absolute left-5 bottom-5 bg-cream/90 rounded-2xl px-4 py-3 shadow-soft">
              <b className="font-display text-lg">Low-impact</b><span className="block text-xs text-ink/60">ramah sendi & segala usia</span>
            </div>
          </div>
        </div>
      </section>

      {/* KELAS */}
      <section id="kelas" className="bg-sand border-y border-sand py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-lg mb-11">
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-600">Kelas kami</span>
            <h2 className="font-display text-4xl font-semibold mt-3">Pilih yang cocok dengan levelmu.</h2>
            <p className="text-ink/60 mt-3">Dari kelas fondasi untuk pemula hingga sesi privat satu-satu.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {CLASSES.map((c) => (
              <div key={c.title} className="bg-cream border border-sand rounded-[20px] overflow-hidden shadow-soft hover:-translate-y-1 transition-transform">
                <div className={`relative aspect-[16/11] bg-gradient-to-br ${c.grad}`}>
                  {media[c.slot] ? (
                    <img src={media[c.slot]} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(120deg,transparent 0 26px,rgba(255,255,255,.16) 26px 27px)' }} />
                      <span className="absolute right-3 top-3 bg-[#2a211c]/40 text-white text-[10.5px] px-2.5 py-1 rounded-full backdrop-blur">Foto kelas</span>
                    </>
                  )}
                  <span className="absolute left-4 bottom-4 w-11 h-11 rounded-xl bg-cream/90 grid place-items-center text-copper-700 shadow-soft"><c.icon size={22} /></span>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-semibold text-xl">{c.title}</h3>
                  <p className="text-ink/60 text-[14.5px] mt-2">{c.desc}</p>
                  <span className="inline-block mt-3.5 text-xs font-semibold tracking-wide text-copper-700 bg-copper-50 border border-copper-100 px-3 py-1 rounded-full">{c.level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CARA MULAI */}
      <section id="cara" className="bg-[#2A211C] text-white/90 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-xl">
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-200">Cara mulai</span>
            <h2 className="font-display text-4xl font-semibold mt-3 text-white">Booking kelas dalam 3 langkah.</h2>
            <p className="text-white/60 mt-3">Semua diatur dari web — pilih jadwal kapan saja, tanpa perlu chat admin dulu.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative border border-white/10 rounded-[18px] p-7 bg-white/[0.03]">
                <div className="font-display font-bold text-[#2A211C] bg-copper-200 w-9 h-9 rounded-full grid place-items-center">{i + 1}</div>
                <h3 className="font-display font-semibold text-xl text-white mt-4">{s.title}</h3>
                <p className="text-white/60 text-[14.5px] mt-2">{s.desc}</p>
                {i < STEPS.length - 1 && <ArrowRight className="hidden md:block absolute top-10 -right-5 text-white/25" size={26} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAKET */}
      <section id="paket" className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-lg mb-11">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-600">Paket</span>
          <h2 className="font-display text-4xl font-semibold mt-3">Dari coba-coba sampai rutin.</h2>
          <p className="text-ink/60 mt-3">Pilih yang pas dengan ritme latihanmu. Bisa upgrade kapan saja.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {(packages ?? []).map((p, i) => {
            const popular = (packages?.length ?? 0) >= 3 && i === 1
            return (
              <div key={p.id} className={`relative rounded-[22px] p-8 flex flex-col shadow-soft ${popular ? 'bg-gradient-to-b from-white to-copper-50 border-2 border-copper-600 shadow-card' : 'bg-cream border border-sand'}`}>
                {popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-copper-600 text-white text-[11.5px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full whitespace-nowrap">Paling populer</span>}
                <h3 className="font-display font-semibold text-xl">{p.name}</h3>
                <div className="text-ink/60 text-sm mt-2 flex items-center gap-1.5">
                  {p.is_unlimited ? <><InfinityIcon size={15} /> Unlimited</> : <><Clock size={15} /> {p.session_count} sesi</>}
                </div>
                <div className="font-display text-4xl font-semibold text-copper-700 mt-4">{formatRupiah(p.price)}</div>
                {p.description && <p className="text-ink/55 text-sm mt-3">{p.description}</p>}
                <Link to="/register" className={`mt-auto pt-6 ${popular ? 'btn-primary' : 'btn-ghost border border-sand'} w-full justify-center`}>Pilih paket</Link>
              </div>
            )
          })}
          {(!packages || packages.length === 0) && <div className="text-ink/40 col-span-full text-center py-8">Paket akan segera tersedia.</div>}
        </div>
      </section>

      {/* TESTIMONI */}
      <section className="bg-sand border-y border-sand py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-lg mx-auto text-center mb-11">
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-600">Kata member</span>
            <h2 className="font-display text-4xl font-semibold mt-3">Cerita dari matras kami.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-cream border border-sand rounded-[18px] p-6 shadow-soft">
                <div className="flex gap-0.5 text-clay mb-3.5">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} fill="currentColor" stroke="none" />)}</div>
                <p className="font-display text-lg font-medium leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-5">
                  <span className="w-11 h-11 rounded-full grid place-items-center text-white bg-gradient-to-br from-[#e9c9b4] to-[#bd7a61] shrink-0"><Users2 size={18} /></span>
                  <div><b className="text-[14.5px]">{t.name}</b><span className="block text-xs text-ink/45">{t.tag}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-lg mx-auto text-center mb-11">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-copper-600">Tanya jawab</span>
          <h2 className="font-display text-4xl font-semibold mt-3">Hal yang sering ditanyakan.</h2>
        </div>
        <div className="max-w-2xl mx-auto space-y-3">
          {FAQ.map((item, i) => (
            <details key={item.q} className="group bg-cream border border-sand open:border-copper-200 rounded-2xl px-6 transition-colors" open={i === 0}>
              <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-display font-semibold text-[16.5px]">
                {item.q}
                <ChevronDown size={20} className="text-copper-600 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-ink/60 text-[15px] leading-relaxed pb-5 -mt-1">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="bg-copper-600 text-white py-24">
        <div className="mx-auto max-w-6xl px-5 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-white/75">Kunjungi kami</span>
            <h2 className="font-display text-4xl font-semibold mt-3">Kelas pertamamu menunggu.</h2>
            <p className="text-white/70 mt-3 max-w-md">Datang, rasakan sesi trial-mu, dan mulai perjalanan bergerak dengan lebih sadar.</p>
            <div className="mt-6">
              {(branches ?? []).map((b) => (
                <div key={b.id} className="py-4 border-t border-white/20">
                  <div className="font-semibold flex items-center gap-2"><Building2 size={17} /> {b.name}</div>
                  {b.address && <div className="flex items-start gap-2 text-white/75 text-sm mt-1.5 ml-7"><MapPin size={14} className="mt-0.5 shrink-0" /> {b.address}</div>}
                  {b.phone && <div className="flex items-center gap-2 text-white/75 text-sm ml-7 mt-1"><Phone size={14} /> {b.phone}</div>}
                </div>
              ))}
              {(!branches || branches.length === 0) && <div className="text-white/50 text-sm">Lokasi cabang dapat diatur di back office.</div>}
            </div>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-[20px] p-8 backdrop-blur">
            <h3 className="font-display text-2xl font-semibold">Sudah jadi member?</h3>
            <p className="text-white/70 mt-2">Masuk untuk lihat sisa kuota, pilih jadwal, dan kelola paketmu.</p>
            <div className="flex flex-col gap-3 mt-6">
              <Link to="/login" className="btn bg-white text-copper-700 hover:bg-cream justify-center">Masuk ke akunku</Link>
              <Link to="/register" className="btn bg-clay text-white hover:bg-clay-dark justify-center">Daftar member baru</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#2A211C] text-white/55 py-11">
        <div className="mx-auto max-w-6xl px-5 flex flex-wrap justify-between items-center gap-5 text-sm">
          <div className="brightness-0 invert opacity-90"><Brand size="sm" imgClassName="!h-8" showName /></div>
          <div>© {new Date().getFullYear()} {name} · Bergerak dengan niat & keseimbangan.</div>
        </div>
      </footer>

      {/* WA MENGAMBANG */}
      {studio?.phone && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label="Chat WhatsApp"
          className="fixed right-5 bottom-5 z-50 w-14 h-14 rounded-full bg-[#25D366] grid place-items-center text-white shadow-lg hover:scale-105 transition-transform">
          <MessageCircle size={26} />
        </a>
      )}
    </div>
  )
}
