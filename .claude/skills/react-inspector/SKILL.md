---
name: react-inspector
description: Installer ou retirer react-dev-inspector dans front/ — le mode "clic sur un élément de la page → ouverture du composant dans VS Code". Use whenever the user wants to inspect/jump to a React component from the browser, says "installe react dev inspector", "je veux cliquer sur un composant pour l'ouvrir", "remets l'inspector", "enlève l'inspector", or complains that the front build is slow because of babel.config.js. Also use before touching app/_components/dev-inspector.tsx, front/babel.config.js, or app/api/dev/open-editor/.
---

# React Dev Inspector

`react-dev-inspector` ajoute un raccourci en dev : `Ctrl+Shift+X` (ou `Ctrl+Shift+clic`) sur un
élément de la page ouvre le fichier source du composant dans VS Code, à la bonne ligne.

L'outil a été retiré du repo. Ce skill sait le remettre et le re-retirer, parce que
l'installation touche quatre points dont deux ne sont pas évidents.

## Pourquoi ce n'est pas un simple `npm i`

Le paquet a besoin de trois pièces qui vivent chacune ailleurs :

1. **Un plugin Babel** qui injecte `data-inspector-*` (fichier, ligne, colonne) dans le JSX.
   Sans lui, le composant React ne sait pas quel fichier ouvrir.
2. **Un endpoint serveur** qui lance l'éditeur. Le navigateur ne peut pas ouvrir VS Code.
3. **Le composant `<Inspector />`** monté dans le layout, qui écoute le raccourci et appelle
   l'endpoint.

Le coût caché : dès que `front/babel.config.js` existe, Next abandonne SWC/Turbopack et
compile avec Babel. Le build passe de quelques secondes à nettement plus, et certaines
features Next (`next/font`) supposent SWC. C'est la raison pour laquelle l'outil a été retiré —
à mentionner à l'utilisateur avant de réinstaller, il voudra peut-être ne le faire que le temps
d'une session de debug UI.

## Installer

Tout se passe dans `front/`.

### 1. Dépendances

```bash
npm i -D react-dev-inspector @react-dev-inspector/babel-plugin react-dev-utils
```

`react-dev-utils` était historiquement tiré en transitif. L'installer explicitement : sinon
l'endpoint `open-editor` compile chez toi et casse le build de quelqu'un d'autre.

### 2. `front/babel.config.js`

```js
module.exports = {
  presets: ['next/babel'],
  plugins: [process.env.NODE_ENV === 'development' && '@react-dev-inspector/babel-plugin'].filter(
    Boolean
  ),
}
```

### 3. `front/app/_components/dev-inspector.tsx`

```tsx
'use client'
import { Inspector } from 'react-dev-inspector'

export function DevInspector() {
  if (process.env.NODE_ENV !== 'development') return null
  return <Inspector />
}
```

### 4. `front/app/api/dev/open-editor/route.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server'
import path from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const launchEditor = require('react-dev-utils/launchEditor') as (
  fileName: string,
  lineNumber: number,
  colNumber: number
) => void

// Force VS Code as editor on all platforms
process.env.REACT_EDITOR = 'code'

const ROOT = process.cwd()

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const fileName = searchParams.get('fileName')
  const lineNumber = Number(searchParams.get('lineNumber') ?? 1)
  const colNumber = Number(searchParams.get('colNumber') ?? 1)

  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
  }

  const absolutePath = path.isAbsolute(fileName) ? fileName : path.resolve(ROOT, fileName)
  launchEditor(absolutePath, lineNumber, colNumber)
  return NextResponse.json({ ok: true })
}
```

Cette route n'a aucun appelant dans le code — l'inspector l'appelle par URL. Un `grep` la
fera donc passer pour du code mort ; elle ne l'est pas tant que l'inspector est monté.

### 5. Monter le composant dans `front/app/layout.tsx`

```tsx
import { DevInspector } from './_components/dev-inspector'
```

puis dans le `<body>`, juste après `<TestModeBanner />` :

```tsx
<DevInspector />
```

### 6. Vérifier

```bash
npx prettier --write app/_components/dev-inspector.tsx app/api/dev/open-editor/route.ts app/layout.tsx
npm run build
```

Le build doit lister `ƒ /api/dev/open-editor` dans les routes. Puis relancer le serveur dev
(`/server-dev`) et tester `Ctrl+Shift+X` sur un élément.

## Retirer

```bash
cd front
rm -f app/_components/dev-inspector.tsx babel.config.js
rm -rf app/api/dev/open-editor
npm uninstall react-dev-inspector @react-dev-inspector/babel-plugin react-dev-utils
```

Puis retirer l'import et le `<DevInspector />` de `app/layout.tsx`.

Garder `app/api/dev/login` et `app/api/dev/users` : ce sont d'autres helpers de dev, sans
rapport.

**Piège du build après suppression d'une route.** Next garde des validateurs de routes générés
dans `.next/dev/types/` et `.next-3001/dev/types/`. Ils référencent encore la route supprimée et
font échouer le typecheck du build :

```
.next/dev/types/validator.ts: error TS2307: Cannot find module '../../../app/api/dev/open-editor/route.js'
```

Ce n'est pas une vraie erreur de code. Purger et rebuilder :

```bash
rm -rf .next/dev/types .next-3001/dev/types && npm run build
```

## État actuel du repo

Retiré (mars 2026). Les quatre points ci-dessus sont absents ; `front/package.json` ne
contient plus aucune de ces dépendances.
