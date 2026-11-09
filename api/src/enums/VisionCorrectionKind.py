from enum import Enum


class VisionCorrectionKind(str, Enum):
    # A field of a read card the user changed in the review screen.
    EDITED = "edited"
    # A card the user added by hand: the detector missed it.
    ADDED = "added"
    # A read card the user threw out: a false detection.
    REMOVED = "removed"
