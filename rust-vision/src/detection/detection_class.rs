#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DetectionClass {
    Card = 0,
    Stars = 1,
    Text = 2,
}
impl TryFrom<usize> for DetectionClass {
    type Error = ();
    fn try_from(value: usize) -> Result<Self, ()> {
        match value {
            0 => Ok(Self::Card),
            1 => Ok(Self::Stars),
            2 => Ok(Self::Text),
            _ => Err(()),
        }
    }
}
pub(super) struct ClassRules {
    pub(super) min_ratio: f32,
    pub(super) max_ratio: f32,
}
impl DetectionClass {
    pub(super) const fn rules(self) -> ClassRules {
        match self {
            Self::Card => ClassRules {
                min_ratio: 0.60,
                max_ratio: 1.2,
            },
            Self::Stars => ClassRules {
                min_ratio: 5.5,
                max_ratio: 7.5,
            },
            Self::Text => ClassRules {
                min_ratio: 2.3,
                // 3.15 rejects a strip the viewport clipped (w/h 3.27-3.47): no card is built from an unreadable row.
                max_ratio: 3.15,
            },
        }
    }
}
