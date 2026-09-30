import html

import nh3


def sanitize_text(value: str) -> str:
    """Strip all HTML/markup from user-provided free text.

    Removes every tag (no tags allowed) so the stored value is plain text and safe to render.
    Entities introduced by escaping are unescaped back to readable characters so normal text
    like ``Cap & Thor`` is preserved without artifacts. The result is trimmed.
    """
    # Repeat until stable: unescaping can reveal entity-encoded markup that the next pass strips.
    previous = None
    while value != previous:
        previous, value = value, html.unescape(nh3.clean(value, tags=set()))
    return value.strip()
