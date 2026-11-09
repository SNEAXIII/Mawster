mod bounding_box;
mod card_detected;
mod detection_class;

use image::DynamicImage;
use ultralytics_inference::Boxes;

pub use bounding_box::*;
pub use card_detected::*;
pub use detection_class::*;

/// Widest possible lead: scores are dot products of unit vectors, in [-1, 1].
const MAX_MARGIN: f32 = 2.0;

#[allow(clippy::cast_possible_truncation)]
#[allow(clippy::cast_sign_loss)]
pub fn read_detections(boxes: &Boxes) -> Vec<Detection> {
    let coords = boxes.xyxy();
    let classes = boxes.cls();
    let mut detections = Vec::with_capacity(boxes.len());
    for box_index in 0..boxes.len() {
        let coords = coords.row(box_index);
        let coords = [coords[0], coords[1], coords[2], coords[3]];
        let class = classes[box_index] as usize;
        if let Ok(class) = DetectionClass::try_from(class)
            && let Some(detection) = Detection::new(class, coords)
        {
            detections.push(detection);
        }
    }
    detections
}

pub fn split_by_class(detections: Vec<Detection>) -> (Vec<CardBox>, Vec<StarsBox>, Vec<TextsBox>) {
    let mut cards_box = Vec::new();
    let mut stars_box = Vec::new();
    let mut texts_box = Vec::new();
    for detection in detections {
        match detection {
            Detection::Card(card) => cards_box.push(card),
            Detection::Stars(star) => stars_box.push(star),
            Detection::Text(text) => texts_box.push(text),
        }
    }
    (cards_box, stars_box, texts_box)
}

/// The best-scoring item and its lead over the runner-up, in one pass; with no
/// runner-up, nothing contests it and the lead is `MAX_MARGIN`.
fn top_two<T>(scores: impl Iterator<Item = (T, f32)>) -> (Option<T>, f32) {
    let mut best: Option<(T, f32)> = None;
    let mut second = f32::NEG_INFINITY;
    for (item, score) in scores {
        match &best {
            Some((_, top)) if score <= *top => second = second.max(score),
            _ => {
                second = best.as_ref().map_or(second, |(_, top)| *top);
                best = Some((item, score));
            }
        }
    }
    let margin = match &best {
        Some((_, top)) if second.is_finite() => top - second,
        _ => MAX_MARGIN,
    };
    (best.map(|(item, _)| item), margin)
}

/// Pairs every card with its stars and text strip, and keeps the 6★ and 7★ ones; the boxes of
/// the lower rarities come back apart, as they still fill a grid cell.
pub fn extract_cards(
    detections: Vec<Detection>,
    image: &DynamicImage,
) -> (Vec<CardDetected<'_>>, Vec<CardBox>) {
    let mut valid_cards: Vec<CardDetected> = Vec::new();
    let mut low_rarity = Vec::new();
    let (cards_box, mut stars_box, mut texts_box) = split_by_class(detections);
    for card in cards_box {
        let stars = stars_box.extract_if(.., |s| s.is_fit_in(&card)).next();
        let text = texts_box.extract_if(.., |t| t.is_fit_in(&card)).next();
        if let Some(stars) = stars
            && let Some(text) = text
        {
            match CardDetected::new(card, stars, text, image) {
                Some(card) => valid_cards.push(card),
                None => low_rarity.push(card),
            }
        }
    }
    (valid_cards, low_rarity)
}
