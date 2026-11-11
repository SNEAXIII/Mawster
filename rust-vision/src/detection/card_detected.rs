use image::{DynamicImage, GenericImageView};
use serde::Serialize;

use super::{
    AscBox, BoundingBox, CardBox, ChampionBox, DetectionClass, PreviewBox, RankSigBox, StarsBox,
    TextsBox, top_two,
};
use crate::gallery::{self, Entry, SUSPICIOUS_MARGIN};

#[derive(Clone, Copy, Debug)]
pub enum Detection {
    Card(CardBox),
    Stars(StarsBox),
    Text(TextsBox),
}

pub fn calculate_ratio(coords: [f32; 4]) -> f32 {
    (coords[2] - coords[0]) / (coords[3] - coords[1])
}

impl Detection {
    pub const fn class(&self) -> DetectionClass {
        match self {
            Self::Card(_) => DetectionClass::Card,
            Self::Stars(_) => DetectionClass::Stars,
            Self::Text(_) => DetectionClass::Text,
        }
    }

    pub(super) fn new(class: DetectionClass, coords: [f32; 4]) -> Option<Self> {
        let rules = class.rules();
        let ratio = calculate_ratio(coords);
        let valid = (rules.min_ratio..=rules.max_ratio).contains(&ratio);
        valid.then(|| {
            let bounding = BoundingBox {
                left: coords[0],
                right: coords[2],
                top: coords[1],
                bottom: coords[3],
            };
            match class {
                DetectionClass::Card => Self::Card(CardBox(bounding)),
                DetectionClass::Stars => Self::Stars(StarsBox(bounding)),
                DetectionClass::Text => Self::Text(TextsBox(bounding)),
            }
        })
    }
}

#[derive(Clone, Debug)]
pub struct CardDetected<'l> {
    pub card_box: CardBox,
    pub stars_box: StarsBox,
    pub text_box: TextsBox,
    pub champion_box: ChampionBox,
    pub asc_box: AscBox,
    pub rank_sig_box: RankSigBox,
    pub preview_box: PreviewBox,
    pub image: &'l DynamicImage,
    pub champion_name: Option<String>,
    /// Score of the top-1 minus the top-2: the confidence the front thresholds.
    pub name_margin: f32,
    pub stars: u8,
    pub rank: Option<u8>,
    pub sig: Option<u8>,
    /// Confidence of the weakest rank/sig digit, `None` when the band shows none.
    pub digit_confidence: Option<f32>,
    pub ascension: Option<u8>,
}

impl<'l> CardDetected<'l> {
    pub fn new(
        card_box: CardBox,
        stars_box: StarsBox,
        text_box: TextsBox,
        image: &'l DynamicImage,
    ) -> Self {
        let stars = Self::get_stars_number(&stars_box, image);
        let asc_box = Self::asc_box(&text_box);
        let champion_box = Self::champion_box(&card_box, &stars_box);
        let preview_box = Self::preview_box(&card_box, &champion_box, &asc_box);
        Self {
            card_box,
            stars_box,
            text_box,
            asc_box,
            rank_sig_box: Self::rank_sig_box(&text_box),
            champion_box,
            preview_box,
            image,
            champion_name: None,
            name_margin: 0.0,
            stars,
            rank: None,
            sig: None,
            digit_confidence: None,
            ascension: None,
        }
    }

    /// The review thumbnail: the card's width, from the champion down to the ascension badge.
    fn preview_box(card: &CardBox, champion: &ChampionBox, asc: &AscBox) -> PreviewBox {
        PreviewBox(BoundingBox {
            left: card.left,
            right: card.right,
            top: champion.top,
            bottom: asc.bottom,
        })
    }

    /// Top-1 of the mosaic gallery on the champion box (`gallery::rank`), and its margin over the top-2.
    pub fn set_champion_name(&mut self, gallery: &[Entry]) {
        let crop = self.champion_box.crop(self.image).to_rgb8();
        let (ranked, _) = gallery::rank(gallery, &crop, SUSPICIOUS_MARGIN);
        let (best, margin) = top_two(
            ranked
                .into_iter()
                .map(|(index, score)| (&gallery[index].name, score)),
        );
        (self.champion_name, self.name_margin) = (best.cloned(), margin);
    }

    pub fn set_ascension(&mut self) {
        self.ascension = crate::asc::read_ascension(&self.asc_box.crop(self.image));
    }

    /// Ascension badge: last fifth of the text strip, lower half, nudged 2 px up-left.
    fn asc_box(text: &TextsBox) -> AscBox {
        let width = (text.right - text.left) / 5.0;
        let height = (text.bottom - text.top) / 2.0;
        let left = (text.left + width * 4.0 - (width / 6.0)).max(0.0);
        let top = (text.top + height - (height / 5.0)).max(0.0);
        AscBox(BoundingBox {
            left,
            top,
            right: left + width,
            bottom: top + height,
        })
    }

    fn rank_sig_box(text: &TextsBox) -> RankSigBox {
        let width = text.right - text.left;
        let height = (text.bottom - text.top) / 3.0;
        let left = text.left;
        let top = text.top + 1.0;
        RankSigBox(BoundingBox {
            left,
            top,
            right: left + width,
            bottom: top + height,
        })
    }

    fn champion_box(card: &CardBox, stars: &StarsBox) -> ChampionBox {
        let width = stars.right - stars.left;
        let height = (stars.bottom - stars.top) * 3.5;
        let left = stars.left;
        let top = stars.top + 1.0;
        ChampionBox(BoundingBox {
            left,
            top: card.top.max(top - height),
            right: left + width,
            bottom: top,
        })
    }

    #[allow(clippy::cast_possible_truncation)]
    #[allow(clippy::cast_sign_loss)]
    fn get_stars_number(stars: &StarsBox, image: &'l DynamicImage) -> u8 {
        let width = stars.width() as u32;
        let step = width / 7;
        let mid_step = step / 2;
        let y_to_check = stars.center().1 as u32;
        let mut to_return = 0u8;
        for index in (0..7u8).rev() {
            let x_to_check = stars.left as u32 + u32::from(index) * step + mid_step;
            let pixel = image.get_pixel(x_to_check, y_to_check);
            let mean = pixel.0.iter().take(3).map(|&c| u32::from(c)).sum::<u32>() / 3;
            if mean > 60 {
                to_return = index + 1;
                break;
            }
        }
        to_return
    }
}

#[derive(Debug, Serialize)]
pub struct CardDetectedPrediction {
    pub champion_name: Option<String>,
    pub stars: u8,
    // `None` is left out: the API's field is a non-null int defaulting to 0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ascension: Option<u8>,
    pub confidence: f32,
    pub preview: PreviewBox,
}

impl From<&CardDetected<'_>> for CardDetectedPrediction {
    fn from(card: &CardDetected<'_>) -> Self {
        Self {
            champion_name: card.champion_name.clone(),
            confidence: card.name_margin,
            stars: card.stars,
            rank: card.rank,
            signature: card.sig,
            ascension: card.ascension,
            preview: card.preview_box,
        }
    }
}
