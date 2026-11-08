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
