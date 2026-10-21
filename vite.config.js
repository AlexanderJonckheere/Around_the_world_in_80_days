// GitHub Pages serves this site from the main branch's /docs folder, under /<repo-name>/.
// `npm run build` writes the finished game to docs/; commit and push it to update the live site.
export default {
  base: '/Around_the_world_in_80_days/',
  build: {
    outDir: 'docs',
    emptyOutDir: true, // docs/ only ever holds the build, so it's safe to clear
  },
};
