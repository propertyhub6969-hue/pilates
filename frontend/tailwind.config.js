/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palet "Rose Gold" — selaras logo Reformer Your Body (tembaga hangat di atas krem)
        cream: '#FAF5EF',   // latar utama (krem hangat)
        sand: '#F3E7DB',    // panel/kartu lembut
        ink: '#3B2E28',     // teks utama (coklat tua hangat)
        clay: {             // aksen terracotta (CTA sekunder)
          DEFAULT: '#C0714E',
          dark: '#A55B3B',
        },
        copper: {           // warna utama (brand) — rose gold / tembaga
          50: '#FBF1EB',
          100: '#F4DED2',
          200: '#E8C2AF',
          400: '#CF9880',
          500: '#BD7A61',
          600: '#A9654E',
          700: '#8A5140',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(59,46,40,0.07)',
        card: '0 4px 24px rgba(59,46,40,0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
