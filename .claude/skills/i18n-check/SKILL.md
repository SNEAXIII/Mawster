---
name: i18n-check
description: Check for missing i18n keys between en.ts and fr.ts locale files, and optionally add new keys to both
user-invocable: true
---

Compare `front/app/i18n/locales/en.ts` and `front/app/i18n/locales/fr.ts`.

1. Report all keys present in one file but missing in the other.
2. If args are provided (e.g. `/i18n-check warStatus "War Status" "Statut de Guerre"`), add the key with the given English and French values to both files.

When reporting missing keys, group them by file (keys missing in en.ts vs keys missing in fr.ts) and show the full dot-notation path.
