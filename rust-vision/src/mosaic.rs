//! Champion recognition without a model: shrink an image onto a grid of square cells,
//! strip its brightness and contrast, and compare two mosaics with a dot product.
use image::{DynamicImage, Rgb, RgbImage, RgbaImage, imageops, imageops::FilterType};

pub const MOSAIC_WIDTH: u32 = 24;
/// Ring of edge cells dropped before comparing: that is where the card frame and badges leak into a crop.
pub const BORDER_CELLS: u32 = 1;
pub const KEPT_WIDTH: u32 = MOSAIC_WIDTH - 2 * BORDER_CELLS;
const CHANNELS: usize = 3;
const EPSILON: f32 = 1e-6;

/// Where the detector's portrait box lands in the portrait, as a fraction of its width:
/// the one framing that fits best over every champion of the verified shots.
const VISIBLE_LEFT: f32 = 0.01;
const VISIBLE_RIGHT: f32 = 0.98;
const VISIBLE_TOP: f32 = 0.212;
const VISIBLE_BOTTOM: f32 = 0.763;
/// Height over width of a full art window.
const BAND_ASPECT: f32 = (VISIBLE_BOTTOM - VISIBLE_TOP) / (VISIBLE_RIGHT - VISIBLE_LEFT);
/// Whole square cells a full art window holds (12.75, so 12).
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
pub const MOSAIC_HEIGHT: u32 = (MOSAIC_WIDTH as f32 * BAND_ASPECT) as u32;

/// The settings an embedding depends on (not the code): a gallery built under others is stale.
pub fn stamp() -> String {
    format!(
        "mosaic w{MOSAIC_WIDTH} h{MOSAIC_HEIGHT} border{BORDER_CELLS} alpha{FOREGROUND_ALPHA} spread{MIN_FOREGROUND_SPREAD} left{VISIBLE_LEFT} right{VISIBLE_RIGHT} top{VISIBLE_TOP} bottom{VISIBLE_BOTTOM}"
    )
}

/// Raw cell averages of the grid rows an image covers, laid out R, G, B, R, G, B...
///
/// Square cells sized by its width, the one dimension a card clipped by the viewport
/// keeps, anchored on its bottom edge: rows above the crop are absent, never stretched into.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
pub fn shrink_to_mosaic(image: &RgbImage) -> (u32, Vec<f32>) {
    let (width, height) = image.dimensions();
    let cell = width as f32 / MOSAIC_WIDTH as f32;
    let rows = ((height as f32 / cell) as u32).min(MOSAIC_HEIGHT);
    if rows == 0 {
        return (0, Vec::new());
    }
    let kept = ((rows as f32 * cell).round() as u32).min(height);
    let bottom = imageops::crop_imm(image, 0, height - kept, width, kept).to_image();
    let values = imageops::resize(&bottom, MOSAIC_WIDTH, rows, FilterType::Triangle)
        .as_raw()
        .iter()
        .map(|&value| f32::from(value))
        .collect();
    (rows, values)
}

/// Raw averages of the covered cells minus the border ring, bottom row last.
pub fn inner_cells(image: &RgbImage) -> Vec<f32> {
    let (rows, values) = shrink_to_mosaic(image);
    let row_len = MOSAIC_WIDTH as usize * CHANNELS;
    let border = BORDER_CELLS as usize * CHANNELS;
    let top = (BORDER_CELLS + rows).saturating_sub(MOSAIC_HEIGHT) as usize;
    values
        .chunks(row_len)
        .take(rows.saturating_sub(BORDER_CELLS) as usize)
        .skip(top)
        .flat_map(|row| &row[border..row_len - border])
        .copied()
        .collect()
}

/// A unit vector over every inner cell, card background included.
pub fn embed(image: &RgbImage) -> Vec<f32> {
    let mut inner = inner_cells(image);
    normalise(&mut inner, |_| true, 0.0);
    inner
}

/// A unit vector over the inner cells `mask` keeps, the others zero.
pub fn embed_masked(image: &RgbImage, mask: &[bool]) -> Vec<f32> {
    let mut inner = inner_cells(image);
    normalise(&mut inner, |cell| mask[cell], MIN_FOREGROUND_SPREAD);
    inner
}

/// Alpha from which a mosaic cell belongs to the champion rather than the card background.
const FOREGROUND_ALPHA: f32 = 128.0;
/// Floor of a channel's spread over a foreground: a near-black champion (Void) has almost none
/// left once the background is gone, and dividing by it amplifies noise. Swept on the GT shots.
const MIN_FOREGROUND_SPREAD: f32 = 40.0;

/// The inner cells the portrait's opaque pixels cover, in `inner_cells` order.
pub fn foreground(portrait: &RgbaImage) -> Vec<bool> {
    let band = cut_visible_band(portrait);
    let alpha = RgbImage::from_fn(band.width(), band.height(), |x, y| {
        Rgb([band.get_pixel(x, y)[3]; CHANNELS])
    });
    inner_cells(&alpha)
        .chunks(CHANNELS)
        .map(|cell| cell[0] >= FOREGROUND_ALPHA)
        .collect()
}

/// `compare`, the query normalised over the cells the champion covers: the card background
/// behind it, plain or prismatic, never counts.
pub fn compare_masked(query_cells: &[f32], embedding: &[f32], mask: &[bool]) -> f32 {
    let common = query_cells.len().min(embedding.len());
    let mask = &mask[mask.len() - common / CHANNELS..];
    let mut query = query_cells[query_cells.len() - common..].to_vec();
    normalise(&mut query, |cell| mask[cell], MIN_FOREGROUND_SPREAD);
    compare(&query, embedding)
}

/// Over the bottom rows both mosaics cover, the rest is ignored: 1.0 for identical,
/// around 0 for unrelated ones.
pub fn compare(embedding: &[f32], other: &[f32]) -> f32 {
    let common = embedding.len().min(other.len());
    embedding[(embedding.len() - common)..]
        .iter()
        .zip(&other[(other.len() - common)..])
        .map(|(left, right)| left * right)
        .sum()
}

/// Per channel, over the cells `keep` selects: minus the mean, so a darker screenshot matches
/// a brighter asset, over the spread (at least `min_spread`), so a washed-out one matches a
/// crisp one. Others zeroed.
#[allow(clippy::cast_precision_loss)]
fn normalise(values: &mut [f32], keep: impl Fn(usize) -> bool, min_spread: f32) {
    let (kept, dropped): (Vec<usize>, Vec<usize>) =
        (0..values.len() / CHANNELS).partition(|&cell| keep(cell));
    let count = kept.len() as f32 + EPSILON;
    for channel in 0..CHANNELS {
        let at = |cell: &usize| cell * CHANNELS + channel;
        let mean = kept.iter().map(|cell| values[at(cell)]).sum::<f32>() / count;
        let variance = kept
            .iter()
            .map(|cell| (values[at(cell)] - mean).powi(2))
            .sum::<f32>()
            / count;
        let spread = variance.sqrt().max(min_spread) + EPSILON;
        for cell in &kept {
            values[at(cell)] = (values[at(cell)] - mean) / spread;
        }
    }
    for cell in dropped {
        values[cell * CHANNELS..(cell + 1) * CHANNELS].fill(0.0);
    }
    scale_to_unit_length(values);
}

fn scale_to_unit_length(values: &mut [f32]) {
    let length = values.iter().map(|value| value * value).sum::<f32>().sqrt() + EPSILON;
    for value in values {
        *value /= length;
    }
}

/// Cuts the band of the portrait a card shows, then lays it on the card background:
/// the RGB under a cut-out's transparent pixels is exporter junk.
pub fn make_portrait_band_with_background(
    portrait: &RgbaImage,
    card_background: &RgbaImage,
) -> RgbImage {
    let band = cut_visible_band(portrait);
    let mut composed = imageops::resize(
        card_background,
        band.width(),
        band.height(),
        FilterType::Triangle,
    );
    imageops::overlay(&mut composed, &band, 0, 0);
    DynamicImage::ImageRgba8(composed).to_rgb8()
}

#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
/// Measured on the width: the art is square, and the few portraits that are not lost
/// empty rows on top (White Tiger 560x534). Bullseye, same size, is cut otherwise: `gallery::OFFSET_ART`.
fn cut_visible_band(portrait: &RgbaImage) -> RgbaImage {
    let (width, height) = portrait.dimensions();
    let trimmed_rows = width.saturating_sub(height) as f32;
    let side = width as f32;
    let top = side.mul_add(VISIBLE_TOP, -trimmed_rows).max(0.0).round() as u32;
    let bottom = side.mul_add(VISIBLE_BOTTOM, -trimmed_rows).round() as u32;
    let left = (side * VISIBLE_LEFT).round() as u32;
    let right = (side * VISIBLE_RIGHT).round() as u32;
    imageops::crop_imm(portrait, left, top, right - left, bottom.min(height) - top).to_image()
}
