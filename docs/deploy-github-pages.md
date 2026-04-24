# Despliegue en GitHub Pages (sin subir secretos al repo)

## Qué no debe estar en Git

- `.env` (valores reales de Firebase Web) — ya ignorado; usar [`.env.example`](../.env.example) como plantilla en local.
- Credenciales de **Admin** (`serviceAccountKey.json`, `*-firebase-adminsdk-*.json`) — ignoradas; solo para scripts locales o CI con otros mecanismos.

Las variables `VITE_FIREBASE_*` se inyectan en el **runner** de GitHub Actions desde **Repository secrets**; el bundle publicado las incluirá (comportamiento normal del cliente Firebase). La protección de datos sigue siendo **Firestore Security Rules** y la configuración en la consola de Firebase.

## 1. Repositorio en GitHub

1. Crea el repo vacío en GitHub.
2. En local: `git remote add origin …` y `git push -u origin main` (o tu rama principal).
3. Comprueba antes de hacer push: `git status` no debe listar `.env` ni JSON de service account.

## 2. Secrets de Actions

En el repo: **Settings → Secrets and variables → Actions → New repository secret**, crea (nombres exactos):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (puede quedar vacío si no usás Analytics)

Los valores salen de Firebase Console → Configuración del proyecto → Tu app web.

## 3. Activar Pages con Actions

1. **Settings → Pages**
2. **Build and deployment → Source**: **GitHub Actions** (no “Deploy from a branch” con `dist` commiteado).

El workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) define `VITE_BASE_PATH` como `/<nombre-del-repo>/`, alineado con `base` en Vite y `basename` en `BrowserRouter`.

## 4. Firebase Authentication (manual)

Para que login (sobre todo **Google**) funcione en `https://<usuario>.github.io/<repo>/`:

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Añade si faltan:
   - `github.io` (dominio base de GitHub Pages)
   - opcionalmente el host exacto que veas en la barra del navegador al abrir la app publicada (p. ej. `<usuario>.github.io`).
3. En **Google Cloud Console** → **APIs y servicios** → **Credenciales** → cliente OAuth tipo **Web** (el de tu app Firebase):
   - **Orígenes autorizados de JavaScript**: incluye al menos  
     `https://<usuario>.github.io`  
     y, si el login falla por origen, también  
     `https://<usuario>.github.io/<repo>` (sin barra final) o la variante que use tu URL exacta.
   - **URIs de redirección autorizadas**: suele bastar con los que ya añade Firebase para `*.firebaseapp.com` / `*.web.app`; si Google devuelve error de redirect, revisá el mensaje y añadí la URI que indique (a veces hace falta la URL completa de Pages).

Tras cambiar dominios u OAuth, puede tardar unos minutos en aplicarse.

## 5. Comprobaciones después del deploy

1. Abre la URL que muestra el job **deploy** (environment `github-pages`).
2. Red: sin 404 en `/…/assets/…`.
3. Navegación interna (rutas bajo el prefijo del repo).
4. Inicio de sesión y una operación mínima contra Firestore.

## 6. Prueba local con la misma base que Pages

En la raíz del proyecto (ajusta `TU_REPO` al nombre del repositorio):

```bash
VITE_BASE_PATH=/TU_REPO/ npm run build
npm run preview
```

Abre la URL que indique `vite preview` y comprueba rutas y assets.
