import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import Brand from '@/components/Brand'
import { formatRupiah } from '@/utils/format'
import {
  Infinity as InfinityIcon, Sparkles, HeartPulse, Wind, Users2,
  MapPin, Phone, ArrowRight, Menu, Building2,
} from 'lucide-react'
import { useState } from 'react'

interface StudioInfo { name: string; tagline?: string | null; address?: string | null; phone?: string | null }
interface Pkg { id: string; name: string; description?: string | null; is_unlimited: boolean; session_count?: number | null; price: number }
interface BranchInfo { id: string; name: string; address?: string | null; phone?: string | null }

const CLASSES = [
  { icon: Wind, title: 'Reformer Flow', desc: 'Gerakan mengalir di atas reformer untuk kekuatan inti, mobilitas, dan postur.' },
  { icon: HeartPulse, title: 'Reformer Basic', desc: 'Kelas fondasi untuk pemula — kenali mesin, napas, dan prinsip pilates dengan tenang.' },
  { icon: Users2, title: 'Private Session', desc: 'Sesi privat satu-satu bersama instruktur, disesuaikan dengan tubuh & tujuanmu.' },
]

const BENEFITS = [
  { title: 'Postur & keseimbangan', desc: 'Latihan terkontrol yang memperbaiki postur dan kesadaran tubuh.' },
  { title: 'Kekuatan tanpa beban berat', desc: 'Bangun otot inti yang stabil lewat resistensi lembut reformer.' },
  { title: 'Kelas kecil & personal', desc: 'Kapasitas terbatas agar setiap gerakanmu diperhatikan instruktur.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: studio } = useQuery({
    queryKey: ['public-studio'],
    queryFn: async () => (await api.get<StudioInfo>('/public/studio')).data,
  })
  const { data: packages } = useQuery({
    queryKey: ['public-packages'],
    queryFn: async () => (await api.get<Pkg[]>('/public/packages')).data,
  })
  const { data: branches } = useQuery({
    queryKey: ['public-branches'],
    queryFn: async () => (await api.get<BranchInfo[]>('/public/branches')).data,
  })

  const name = studio?.name ?? 'Reformer Your Body'

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* NAV */}
      <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-sand">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <a href="#top"><Brand size="sm" imgClassName="!h-10" showName /></a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-ink/70">
            <a href="#kelas" className="hover:text-ink">Kelas</a>
            <a href="#paket" className="hover:text-ink">Paket</a>
            <a href="#kontak" className="hover:text-ink">Kontak</a>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="btn-primary">Masuk</Link>
          </div>
          <button className="md:hidden btn-ghost !px-2" onClick={() => setMenuOpen((v) => !v)}><Menu size={20} /></button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-sand bg-cream px-5 py-4 flex flex-col gap-3">
            <a href="#kelas" onClick={() => setMenuOpen(false)} className="text-ink/70">Kelas</a>
            <a href="#paket" onClick={() => setMenuOpen(false)} className="text-ink/70">Paket</a>
            <a href="#kontak" onClick={() => setMenuOpen(false)} className="text-ink/70">Kontak</a>
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="btn-primary flex-1">Masuk</Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-copper-100 blur-3xl opacity-60" />
        <div className="absolute top-40 -left-24 w-80 h-80 rounded-full bg-clay/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-copper-600 bg-copper-50 rounded-full px-3 py-1">
              <Sparkles size={14} /> Studio Pilates Reformer
            </span>
            <h1 className="font-display text-5xl sm:text-6xl font-semibold leading-[1.05] mt-5">
              Bergerak dengan niat &amp; keseimbangan.
            </h1>
            <p className="text-ink/60 text-lg mt-5 max-w-md">
              {studio?.tagline ?? 'Bangun kekuatan inti, perbaiki postur, dan temukan ketenangan lewat pilates reformer dalam kelas kecil yang personal.'}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/register" className="btn-primary text-base !px-6 !py-3">Mulai sekarang <ArrowRight size={18} /></Link>
              <a href="#paket" className="btn-ghost text-base !px-6 !py-3">Lihat paket</a>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-[2rem] bg-gradient-to-br from-sand to-copper-100 shadow-card grid place-items-center p-10 border border-copper-200/60">
              <div className="text-center">
                <Brand size="lg" imgClassName="!h-44 mx-auto" />
                <p className="text-ink/45 text-xs mt-6 tracking-[0.2em] uppercase">Reformer · Mat · Private</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid sm:grid-cols-3 gap-6">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card">
              <h3 className="font-semibold text-lg">{b.title}</h3>
              <p className="text-ink/55 text-sm mt-2">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KELAS */}
      <section id="kelas" className="bg-sand/50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-lg">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold">Kelas kami</h2>
            <p className="text-ink/55 mt-3">Pilih kelas yang cocok dengan level dan tujuanmu.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {CLASSES.map((c) => (
              <div key={c.title} className="card">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-copper-50 text-copper-600"><c.icon size={24} /></span>
                <h3 className="font-semibold text-lg mt-4">{c.title}</h3>
                <p className="text-ink/55 text-sm mt-2">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAKET */}
      <section id="paket" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-lg">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold">Paket</h2>
            <p className="text-ink/55 mt-3">Mulai dari coba-coba sampai rutin — pilih yang pas.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {(packages ?? []).map((p) => (
              <div key={p.id} className="card flex flex-col">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <div className="mt-2 text-sm text-ink/60">
                  {p.is_unlimited ? <span className="inline-flex items-center gap-1"><InfinityIcon size={15} /> Unlimited</span> : `${p.session_count} sesi`}
                </div>
                {p.description && <p className="text-ink/50 text-sm mt-2">{p.description}</p>}
                <div className="font-display text-2xl font-semibold text-copper-700 mt-4">{formatRupiah(p.price)}</div>
                <Link to="/register" className="btn-primary w-full mt-4">Pilih paket ini</Link>
              </div>
            ))}
            {(!packages || packages.length === 0) && (
              <div className="text-ink/40 col-span-full text-center py-8">Paket akan segera tersedia.</div>
            )}
          </div>
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="bg-copper-600 text-white py-20">
        <div className="mx-auto max-w-6xl px-5 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold">Kunjungi kami</h2>
            <p className="text-white/70 mt-3 max-w-md">Datang, rasakan kelas pertamamu, dan mulai perjalanan bergerak dengan lebih sadar.</p>
            <div className="mt-6 space-y-4">
              {(branches ?? []).map((b) => (
                <div key={b.id} className="text-white/85">
                  <div className="font-semibold flex items-center gap-2"><Building2 size={16} /> {b.name}</div>
                  {b.address && <div className="flex items-start gap-2 text-white/70 text-sm mt-1 ml-6"><MapPin size={14} className="mt-0.5 shrink-0" /> {b.address}</div>}
                  {b.phone && <div className="flex items-center gap-2 text-white/70 text-sm ml-6"><Phone size={14} /> {b.phone}</div>}
                </div>
              ))}
              {(!branches || branches.length === 0) && (
                <div className="text-white/50 text-sm">Lokasi cabang dapat diatur di back office.</div>
              )}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl2 p-8 backdrop-blur">
            <h3 className="font-display text-2xl font-semibold">Sudah jadi member?</h3>
            <p className="text-white/70 mt-2">Masuk untuk lihat sisa kuota &amp; kelola paketmu.</p>
            <div className="flex gap-3 mt-6">
              <Link to="/login" className="btn bg-white text-copper-700 hover:bg-cream flex-1">Masuk</Link>
              <Link to="/register" className="btn bg-clay text-white hover:bg-clay-dark flex-1">Daftar</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-ink/40 text-sm">
        © {new Date().getFullYear()} {name}. Bergerak dengan niat &amp; keseimbangan.
      </footer>
    </div>
  )
}
