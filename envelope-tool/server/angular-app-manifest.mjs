
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/envelope_tool/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/envelope_tool"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 13226, hash: '96829cc85072c745913ee098a973c79a57a82e7345b06df1e8d2ded0856eebb2', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 13739, hash: 'd844de1ffc68063bf44f7de2d79c3e370c8e4a52b65efb20dfac0f86892b4d5c', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 34264, hash: '82480200a8112cfb3ca889d4beca8792414e41749145012d06515e916170006d', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-5INURTSO.css': {size: 0, hash: 'menYUTfbRu8', text: () => import('./assets-chunks/styles-5INURTSO_css.mjs').then(m => m.default)}
  },
};
