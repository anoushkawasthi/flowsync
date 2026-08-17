module.exports = {
  plugins: {
    // Must run before tailwindcss so the token/primitive partials are inlined
    // and Tailwind sees their @layer rules.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
