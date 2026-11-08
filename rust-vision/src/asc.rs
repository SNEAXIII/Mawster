//! Ascension without a model: the badge's gold says whether there is one, the width of
//! the pale glyph at its centre which level.
use image::{DynamicImage, GrayImage, Luma, Rgb, imageops::FilterType};
use imageproc::region_labelling::{Connectivity, connected_components};

/// The crop is a few dozen pixels wide: thresholding it upscaled keeps the glyph's strokes whole.
const UPSCALE: u32 = 4;
/// Share of gold pixels above which the corner holds a badge.
const GOLD_SHARE: f32 = 0.08;
/// A zoomed-out shot blurs the glyph to grey: its threshold sits halfway between the badge
/// centre's median and its brightest pixel, never below this floor.
const GLYPH_MIN: u8 = 90;
/// Max minus min channel: the glyph is grey-white, the gold around it is not.
const GLYPH_MAX_SATURATION: u8 = 60;
/// Width over height under which the glyph is a 1. Measured on data/real: 1s top at 0.46,
/// 2s start at 0.74.
const ONE_MAX_ASPECT: f32 = 0.6;

/// `Some(0)` without a badge, `None` when there is one but its digit is unreadable.
#[allow(clippy::cast_precision_loss)]
pub fn read_ascension(crop: &DynamicImage) -> Option<u8> {
    let rgb = crop.to_rgb8();
    let pixels = rgb.pixels().count();
    if pixels == 0 {
        return None;
    }
    let gold = rgb.pixels().filter(|p| is_gold(**p)).count() as f32 / pixels as f32;
    if gold < GOLD_SHARE {
        return Some(0);
    }
    let big = image::imageops::resize(
        &rgb,
        rgb.width() * UPSCALE,
        rgb.height() * UPSCALE,
        FilterType::Triangle,
    );
    let glyph = largest_blob(&glyph_mask(&big))?;
    classify(&glyph)
}

/// Pale, unsaturated pixels brighter than the badge centre's threshold, the wings' tips excluded.
#[allow(clippy::cast_possible_truncation)]
fn glyph_mask(big: &image::RgbImage) -> GrayImage {
    let (width, height) = big.dimensions();
    let min_channel = |x, y| {
        let Rgb([r, g, b]) = *big.get_pixel(x, y);
        r.min(g).min(b)
    };
    let mut centre: Vec<u8> = (height / 4..3 * height / 4)
        .flat_map(|y| (width / 4..3 * width / 4).map(move |x| (x, y)))
        .map(|(x, y)| min_channel(x, y))
        .collect();
    centre.sort_unstable();
    let median = centre.get(centre.len() / 2).copied().unwrap_or(0);
    let brightest = centre.last().copied().unwrap_or(0);

    let threshold = GLYPH_MIN.max(median.midpoint(brightest));
    GrayImage::from_fn(width, height, |x, y| {
        let Rgb([r, g, b]) = *big.get_pixel(x, y);
        let (lo, hi) = (r.min(g).min(b), r.max(g).max(b));
        let on = lo >= threshold
            && hi - lo < GLYPH_MAX_SATURATION
            && (height / 6..height - height / 6).contains(&y);
        Luma([if on { 255 } else { 0 }])
    })
}

/// Warm and saturated: the badge's wings, not the grey card or the purple frame.
fn is_gold(Rgb([r, g, b]): Rgb<u8>) -> bool {
    let (r, g, b) = (i16::from(r), i16::from(g), i16::from(b));
    r > 140 && r - b > 60 && g - b > 20
}

/// The largest 8-connected white blob, cut to its bounding box.
fn largest_blob(mask: &GrayImage) -> Option<GrayImage> {
    let labels = connected_components(mask, Connectivity::Eight, Luma([0u8]));
    let mut areas = std::collections::HashMap::<u32, usize>::new();
    for label in labels.pixels().map(|p| p[0]).filter(|&l| l != 0) {
        *areas.entry(label).or_default() += 1;
    }
    let (&label, _) = areas.iter().max_by_key(|(_, area)| **area)?;
    let (mut x0, mut y0, mut x1, mut y1) = (u32::MAX, u32::MAX, 0, 0);
    for (x, y, _) in labels.enumerate_pixels().filter(|(_, _, p)| p[0] == label) {
        (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
    }
    Some(GrayImage::from_fn(x1 - x0 + 1, y1 - y0 + 1, |x, y| {
        let on = labels.get_pixel(x0 + x, y0 + y)[0] == label;
        Luma([if on { 255 } else { 0 }])
    }))
}

/// A 1 by its narrowness, else a 2.
// ponytail: any wide glyph reads as 2, so a 3 or 4 badge will be misread. Add them from real
// game crops once they ship: the 7-segment grid misread real 2s, and 3/4 synthesised from 2s proved nothing.
#[allow(clippy::cast_precision_loss)]
fn classify(glyph: &GrayImage) -> Option<u8> {
    let (w, h) = (glyph.width() as f32, glyph.height() as f32);
    if h < 8.0 {
        return None;
    }
    Some(if w / h < ONE_MAX_ASPECT { 1 } else { 2 })
}
