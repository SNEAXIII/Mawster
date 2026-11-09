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

/// Pairs every card with its stars and text strip, and keeps the 6★ and 7★ ones.
pub fn extract_cards(detections: Vec<Detection>, image: &DynamicImage) -> Vec<CardDetected<'_>> {
    let mut valid_cards: Vec<CardDetected> = Vec::new();
    let (cards_box, mut stars_box, mut texts_box) = split_by_class(detections);
    for card in cards_box {
        let stars = stars_box.extract_if(.., |s| s.is_fit_in(&card)).next();
        let text = texts_box.extract_if(.., |t| t.is_fit_in(&card)).next();
        if let Some(stars) = stars
            && let Some(text) = text
            && let Some(card) = CardDetected::new(card, stars, text, image)
        {
            valid_cards.push(card);
        }
    }
    valid_cards
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use super::*;

    #[rstest]
    #[case::nothing(&[], None, MAX_MARGIN)]
    #[case::uncontested(&[0.5], Some(0), MAX_MARGIN)]
    #[case::best_first(&[0.9, 0.2, 0.5], Some(0), 0.4)]
    #[case::best_in_the_middle(&[0.2, 0.9, 0.5], Some(1), 0.4)]
    #[case::best_last(&[0.2, 0.5, 0.9], Some(2), 0.4)]
    #[case::a_tie_has_no_lead(&[0.7, 0.7], Some(0), 0.0)]
    fn top_two_finds_the_best_and_its_lead(
        #[case] scores: &[f32],
        #[case] best: Option<usize>,
        #[case] lead: f32,
    ) {
        let (found, margin) = top_two(scores.iter().copied().enumerate());
        assert_eq!(found, best);
        assert!((margin - lead).abs() < 1e-6, "{margin}");
    }

    #[rstest]
    #[case::card(DetectionClass::Card, 100.0, 100.0, true)]
    #[case::thin_card(DetectionClass::Card, 50.0, 100.0, false)]
    #[case::star_row(DetectionClass::Stars, 70.0, 10.0, true)]
    #[case::short_star_row(DetectionClass::Stars, 40.0, 10.0, false)]
    #[case::text_strip(DetectionClass::Text, 300.0, 100.0, true)]
    #[case::strip_clipped_by_the_viewport(DetectionClass::Text, 330.0, 100.0, false)]
    fn a_box_outside_its_class_ratio_is_dropped(
        #[case] class: DetectionClass,
        #[case] width: f32,
        #[case] height: f32,
        #[case] kept: bool,
    ) {
        assert_eq!(
            Detection::new(class, [10.0, 20.0, 10.0 + width, 20.0 + height]).is_some(),
            kept
        );
    }
}
