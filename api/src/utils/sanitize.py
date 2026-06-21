import html

import bleach


def sanitize_text(value: str) -> str:
    """Strip all HTML/markup from user-provided free text.

    Removes every tag (no tags allowed) so the stored value is plain text and safe to render.
    Entities introduced by escaping are unescaped back to readable characters so normal text
    like ``Cap & Thor`` is preserved without artifacts. The result is trimmed.
    """
    stripped = bleach.clean(value, tags=[], attributes={}, strip=True)
    return html.unescape(stripped).strip()
