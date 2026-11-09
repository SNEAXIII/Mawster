use ultralytics_inference::Results;

/// The letter glyphs of the "Rank" and "Sig." words.
const LABEL_CLASS: u8 = 10;
const MAX_SIG_DIGITS: usize = 3;
const RANK_MAX: u8 = 5;
const SIG_MAX: u8 = 200;
const NMS_IOU: f32 = 0.5;
/// A glyph touching the band's edge is half a glyph, often a phantom on the card's gold frame.
const EDGE_PX: f32 = 1.0;
/// Digits of one number sit 0.01-0.02 of the band apart, rank to sig 0.238: past this, a new token.
const MAX_INTRA_NUMBER_GAP: f32 = 0.04;
/// The rank-to-sig gap must dwarf every other gap for the split to mean anything.
const SPLIT_DOMINANCE: f32 = 2.0;

#[derive(Clone, Copy)]
struct Glyph {
    class: u8,
    confidence: f32,
    xyxy: [f32; 4],
}

impl Glyph {
    const fn center_x(&self) -> f32 {
        self.xyxy[0].midpoint(self.xyxy[2])
    }
}

// YOLO class ids are small non-negative integers stored as f32.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn glyphs(results: &[Results]) -> Vec<Glyph> {
    results
        .iter()
        .filter_map(|result| result.boxes.as_ref())
        .flat_map(|boxes| {
            let coords = boxes.xyxy();
            let classes = boxes.cls();
            let confidences = boxes.conf();
            (0..boxes.len())
                .map(|i| {
                    let c = coords.row(i);
                    Glyph {
                        class: classes[i] as u8,
                        confidence: confidences[i],
                        xyxy: [c[0], c[1], c[2], c[3]],
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

fn iou(a: &[f32; 4], b: &[f32; 4]) -> f32 {
    let area = |r: &[f32; 4]| (r[2] - r[0]) * (r[3] - r[1]);
    let inter =
        (a[2].min(b[2]) - a[0].max(b[0])).max(0.0) * (a[3].min(b[3]) - a[1].max(b[1])).max(0.0);
    inter / (area(a) + area(b) - inter)
}

/// Class-agnostic on top of the crate's per-class NMS: two boxes on one glyph are rival
/// readings, and a weak "7" kept over a "0" turns "200" into a refused four-digit sig.
fn suppress_overlaps(mut glyphs: Vec<Glyph>) -> Vec<Glyph> {
    glyphs.sort_by(|a, b| b.confidence.total_cmp(&a.confidence));
    let mut kept: Vec<Glyph> = Vec::with_capacity(glyphs.len());
    for glyph in glyphs {
        if kept.iter().all(|k| iou(&k.xyxy, &glyph.xyxy) <= NMS_IOU) {
            kept.push(glyph);
        }
    }
    kept
}

/// The rank is the last digit before the split: anything left of it is the label word.
fn rank_of(side: &[Glyph], width: f32) -> Option<u8> {
    match side {
        [.., before, last] if (last.xyxy[0] - before.xyxy[2]) / width <= MAX_INTRA_NUMBER_GAP => {
            None
        }
        [.., last] => Some(last.class).filter(|class| (1..=RANK_MAX).contains(class)),
        [] => None,
    }
}

/// 0 is legal: an unawakened champion reads "Sig. 0".
fn sig_of(side: &[Glyph]) -> Option<u8> {
    if side.is_empty() || side.len() > MAX_SIG_DIGITS {
        return None;
    }
    let value = side
        .iter()
        .fold(0_u16, |acc, glyph| acc * 10 + u16::from(glyph.class));
    u8::try_from(value).ok().filter(|&sig| sig <= SIG_MAX)
}

/// `(rank, sig)` off one band `width` px wide, split at the widest gap. Refuses rather
/// than guesses: a confident wrong rank is worse than a missing one.
pub fn read_rank_sig(results: &[Results], width: f32) -> (Option<u8>, Option<u8>) {
    let mut digits: Vec<Glyph> = suppress_overlaps(glyphs(results))
        .into_iter()
        .filter(|g| g.class != LABEL_CLASS && g.xyxy[0] > EDGE_PX && g.xyxy[2] < width - EDGE_PX)
        .collect();
    // One digit alone gives no gap: it could be the rank or a stray sig digit.
    if digits.len() < 2 {
        return (None, None);
    }
    digits.sort_by(|a, b| a.center_x().total_cmp(&b.center_x()));
    let gaps: Vec<f32> = digits
        .windows(2)
        .map(|pair| (pair[1].xyxy[0] - pair[0].xyxy[2]) / width)
        .collect();
    let Some((split, &widest)) = gaps.iter().enumerate().max_by(|a, b| a.1.total_cmp(b.1)) else {
        return (None, None);
    };
    let runner_up = gaps
        .iter()
        .enumerate()
        .filter(|&(i, _)| i != split)
        .map(|(_, &gap)| gap)
        .fold(f32::NEG_INFINITY, f32::max);
    if widest <= MAX_INTRA_NUMBER_GAP || widest < SPLIT_DOMINANCE * runner_up {
        return (None, None);
    }
    let (rank_side, sig_side) = digits.split_at(split + 1);
    (rank_of(rank_side, width), sig_of(sig_side))
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::cast_precision_loss)]

    use std::sync::Arc;

    use ndarray::{Array2, Array3};
    use rstest::rstest;
    use ultralytics_inference::{Boxes, Speed};

    use super::*;

    /// One `(class, left)` per 4 px wide glyph on a 100 px band. Confidence falls along
    /// the list: of two overlapping glyphs, the first listed wins.
    fn read(glyphs: &[(u8, f32)]) -> (Option<u8>, Option<u8>) {
        let data: Vec<f32> = glyphs
            .iter()
            .enumerate()
            .flat_map(|(i, &(class, left))| {
                let confidence = 0.9 - i as f32 / 100.0;
                [left, 0.0, left + 4.0, 10.0, confidence, f32::from(class)]
            })
            .collect();
        let mut result = Results::new(
            Array3::zeros((1, 1, 3)),
            String::new(),
            Arc::default(),
            Speed::default(),
            (1, 1),
        );
        let rows = Array2::from_shape_vec((glyphs.len(), 6), data).unwrap();
        result.boxes = Some(Boxes::new(rows, (1, 1)));
        read_rank_sig(&[result], 100.0)
    }

    #[rstest]
    #[case::rank_and_max_sig(&[(5, 10.0), (2, 40.0), (0, 45.0), (0, 50.0)], Some(5), Some(200))]
    #[case::unawakened_sig(&[(3, 10.0), (0, 40.0)], Some(3), Some(0))]
    #[case::label_glyphs_are_ignored(&[(10, 2.0), (10, 7.0), (4, 12.0), (7, 50.0)], Some(4), Some(7))]
    #[case::sig_over_the_cap(&[(5, 10.0), (2, 40.0), (0, 45.0), (1, 50.0)], Some(5), None)]
    #[case::four_digit_sig(&[(5, 10.0), (0, 40.0), (0, 45.0), (1, 50.0), (5, 55.0)], Some(5), None)]
    #[case::rank_over_the_cap(&[(6, 10.0), (7, 50.0)], None, Some(7))]
    #[case::rank_zero(&[(0, 10.0), (7, 50.0)], None, Some(7))]
    #[case::two_digit_rank(&[(1, 10.0), (2, 15.0), (7, 50.0)], None, Some(7))]
    #[case::stray_digit_before_the_rank(&[(8, 2.0), (3, 12.0), (7, 50.0)], Some(3), Some(7))]
    #[case::nothing(&[], None, None)]
    #[case::lone_digit(&[(5, 40.0)], None, None)]
    #[case::no_dominant_gap(&[(5, 10.0), (2, 30.0), (7, 50.0)], None, None)]
    #[case::one_tight_number(&[(1, 40.0), (2, 45.0)], None, None)]
    #[case::phantom_on_the_right_edge(&[(5, 10.0), (7, 40.0), (9, 96.0)], Some(5), Some(7))]
    #[case::phantom_on_the_left_edge(&[(3, 0.5), (5, 40.0)], None, None)]
    #[case::rival_box_loses(&[(5, 10.0), (2, 40.0), (0, 45.0), (0, 50.0), (7, 50.0)], Some(5), Some(200))]
    #[case::rival_box_wins(&[(5, 10.0), (2, 40.0), (0, 45.0), (7, 50.0), (0, 50.0)], Some(5), None)]
    fn reads_rank_and_sig(
        #[case] glyphs: &[(u8, f32)],
        #[case] rank: Option<u8>,
        #[case] sig: Option<u8>,
    ) {
        assert_eq!(read(glyphs), (rank, sig));
    }
}
