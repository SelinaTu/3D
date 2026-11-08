// #created 11/08/2026
module.exports = {
  electronDist: 'node_modules/electron/dist',
  appId: 'com.cargoplan.desktop',
  productName: '3D CargoPlan',
  directories: { output: 'output/desktop/release' },
  files: ['desktop/*.mjs', 'desktop/preload.cjs', 'desktop/icon.icns', 'dist/**/*', 'dist-server/**/*', 'data/demo-items.json', 'package.json', '!**/*.map'],
  asar: false,
  mac: { icon: 'desktop/icon.icns', category: 'public.app-category.business', target: [{ target: 'dmg', arch: ['arm64'] }, { target: 'zip', arch: ['arm64'] }], identity: null },
  dmg: { title: '3D CargoPlan', contents: [{ x: 130, y: 200 }, { x: 410, y: 200, type: 'link', path: '/Applications' }] },
  artifactName: '${productName}-${version}-mac-${arch}.${ext}'
}
