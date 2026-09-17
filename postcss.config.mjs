// PostCSS runs only for Tailwind: the plugin compiles `app/tailwind.css` and passes every
// file without Tailwind at-rules (globals.css, all *.module.css) through untouched.
// Vendor prefixing is NOT configured here on purpose — under Turbopack it is Lightning CSS
// that prefixes, from Next's browserslist targets, whether or not this file exists
// (node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md, "CSS and styling").
// A named const rather than an anonymous default export: `import/no-anonymous-default-export`.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
