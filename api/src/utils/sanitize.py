import html

import nh3

MAX_PASSES = 5


def sanitize_text(value: str) -> str:
    """Strip all HTML/markup from user-provided free text.

    Removes every tag (no tags allowed) so the stored value is plain text and safe to render.
    Entities introduced by escaping are unescaped back to readable characters so normal text
    like ``Cap & Thor`` is preserved without artifacts. The result is trimmed.
    Raises ``ValueError`` when the text is still changing after ``MAX_PASSES``.
    """
    # Repeat until stable: unescaping can reveal entity-encoded markup that the next pass strips.
    # Bounded because each pass peels one entity level: deep nesting made the loop quadratic.
    for _ in range(MAX_PASSES):
        previous, value = value, html.unescape(nh3.clean(value, tags=set()))
        if value == previous:
            return value.strip()
    msg = "text is nested too deeply"
    raise ValueError(msg)
