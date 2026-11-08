//! Champion recognition without a model: shrink an image onto a grid of square cells,
//! strip its brightness and contrast, and compare two mosaics with a dot product.
use image::{DynamicImage, RgbImage, RgbaImage, imageops, imageops::FilterType};

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
        "mosaic w{MOSAIC_WIDTH} h{MOSAIC_HEIGHT} border{BORDER_CELLS} left{VISIBLE_LEFT} right{VISIBLE_RIGHT} top{VISIBLE_TOP} bottom{VISIBLE_BOTTOM}"
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

/// A unit vector over the covered cells minus the border ring, bottom row last.
pub fn embed(image: &RgbImage) -> Vec<f32> {
    let (rows, values) = shrink_to_mosaic(image);
    let row_len = MOSAIC_WIDTH as usize * CHANNELS;
    let border = BORDER_CELLS as usize * CHANNELS;
    let top = (BORDER_CELLS + rows).saturating_sub(MOSAIC_HEIGHT) as usize;
    let mut inner: Vec<f32> = values
        .chunks(row_len)
        .take(rows.saturating_sub(BORDER_CELLS) as usize)
        .skip(top)
        .flat_map(|row| &row[border..row_len - border])
        .copied()
        .collect();
    normalise(&mut inner);
    inner
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

fn normalise(values: &mut [f32]) {
    for channel in 0..CHANNELS {
        remove_brightness(values, channel);
        remove_contrast(values, channel);
    }
    scale_to_unit_length(values);
}

/// Subtracts the channel's mean, so a darker screenshot matches a brighter asset.
#[allow(clippy::cast_precision_loss)]
fn remove_brightness(values: &mut [f32], channel: usize) {
    let cell_count = (values.len() / CHANNELS) as f32 + EPSILON;
    let mean = values.iter().skip(channel).step_by(CHANNELS).sum::<f32>() / cell_count;
    for value in values.iter_mut().skip(channel).step_by(CHANNELS) {
        *value -= mean;
    }
}

/// Divides the channel by its spread, so a washed-out screenshot matches a crisp asset.
#[allow(clippy::cast_precision_loss)]
fn remove_contrast(values: &mut [f32], channel: usize) {
    let cell_count = (values.len() / CHANNELS) as f32 + EPSILON;
    let sum_of_squares: f32 = values
        .iter()
        .skip(channel)
        .step_by(CHANNELS)
        .map(|value| value * value)
        .sum();
    let spread = (sum_of_squares / cell_count).sqrt() + EPSILON;
    for value in values.iter_mut().skip(channel).step_by(CHANNELS) {
        *value /= spread;
    }
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
