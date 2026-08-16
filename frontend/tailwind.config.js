/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palet "Calm Studio" — hangat & tenang, khas wellness (bukan korporat)
        cream: '#FAF8F5',   // latar utama
        sand: '#F1ECE4',    // panel/kartu lembut
        ink: '#2A2724',     // teks utama
        clay: {             // aksen terracotta hangat (CTA sekunder)
          DEFAULT: '#C97B5A',
          dark: '#B5674A',
        },
        sage: {             // warna utama (brand)
          50: '#F0F3EF',
          100: '#DCE4DA',
          200: '#B9C8B5',
          400: '#7E9377',
          500: '#5F7659',
          600: '#4C6147',
          700: '#3C4E39',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(42,39,36,0.06)',
        card: '0 4px 24px rgba(42,39,36,0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
