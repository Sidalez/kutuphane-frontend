/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
   extend: {
  colors: {
    primary: {
      DEFAULT: "#E65B00",   // koyu & güçlü turuncu
      soft: "#FFD6B8"       // pastel destek tonu
    }
  }
}

  },
  plugins: []
};
