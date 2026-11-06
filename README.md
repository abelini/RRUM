# RRUM — Landing

Landing estática de la **Red de Radios Universitarias de México**.

- **Astro 7** + **Tailwind 4** (CSS -first, tokens en `src/styles/global.css`)
- Sin servidor Node en producción: build estático, deploy por FTP
- Noticias reales vía **WP REST API** (`rrum.mx/wp-json`, categorías 2 y 7) con fallback elegante
- Deploy beta: `beta.rrum.mx` — final: raíz de `rrum.mx`

## Comandos

```bash
npm install
npm run dev       # desarrollo
npm run build     # genera dist/
npm run preview   # sirve dist/ en localhost:4321
```

## Estructura

```
src/components/   secciones (Hero, Noticias, Radios, Mesa, Footer…)
src/scripts/      interacciones + fetch de noticias
src/styles/       tokens de diseño y estilos globales
src/data/         radios y mesa directiva (estáticos)
dist/             build de producción (incluido para deploy FTP)
```

## Deploy

Subir el contenido de `dist/` (incluye `.htaccess`) a la raíz destino del hosting.
