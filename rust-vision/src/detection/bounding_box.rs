use std::ops::{Deref, DerefMut};

use image::DynamicImage;
use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct BoundingBox {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}
impl BoundingBox {
    pub const fn center(&self) -> (f32, f32) {
        (
            self.left.midpoint(self.right),
            self.top.midpoint(self.bottom),
        )
    }
    pub fn width(&self) -> f32 {
        self.right - self.left
    }
    pub fn height(&self) -> f32 {
        self.bottom - self.top
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    pub fn crop(&self, image: &DynamicImage) -> DynamicImage {
        image.crop_imm(
            self.left as u32,
            self.top as u32,
            self.width() as u32,
            self.height() as u32,
        )
    }
}
macro_rules! box_types {
    ($($name:ident),*) => {$(
        #[derive(Clone, Copy, Debug, Serialize)]
        pub struct $name(pub(super) BoundingBox);
        impl Deref for $name {
            type Target = BoundingBox;
            fn deref(&self) -> &BoundingBox {
                &self.0
            }
        }
        impl DerefMut for $name {
            fn deref_mut(&mut self) -> &mut BoundingBox {
                &mut self.0
            }
        }
    )*};
}
box_types!(CardBox, StarsBox, TextsBox, ChampionBox, AscBox, RankSigBox, PreviewBox);
pub(super) trait FitIn {
    fn is_fit_in(&self, card: &CardBox) -> bool;
}
impl FitIn for BoundingBox {
    fn is_fit_in(&self, card: &CardBox) -> bool {
        let (cx, cy) = self.center();
        (card.left..=card.right).contains(&cx) && (card.top..=card.bottom).contains(&cy)
    }
}
