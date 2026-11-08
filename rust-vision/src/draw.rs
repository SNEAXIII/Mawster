use std::collections::HashMap;

use ab_glyph::{FontRef, PxScale};
use anyhow::Context;
use image::{Rgb, RgbImage, imageops};
use imageproc::drawing::{draw_text_mut, text_size};
use serde_json::{Map, Value};
use ultralytics_inference::{Boxes, Results, annotate::check_font};

use crate::gt;
use mcoc_vision::{
    detection::{BoundingBox, CardDetected, DetectionClass, calculate_ratio},
    pipeline::Matrix,
};

#[derive(Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum Overlay {
    Yolo,
    Dots,
    Ratio,
    Boxes,
    Digits,
    Matrix,
    Dims,
}

/// The per-card boxes `Boxes` and `Dims` draw.
#[derive(Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum BoxKind {
    Card,
    Stars,
    Text,
    Asc,
    RankSig,
    Champion,
}

impl BoxKind {
    fn of<'c>(self, card: &'c CardDetected) -> (&'c BoundingBox, [u8; 3]) {
        match self {
            Self::Card => (&card.card_box, [0, 255, 0]),
            Self::Stars => (&card.stars_box, [255, 255, 0]),
            Self::Text => (&card.text_box, [0, 255, 255]),
            Self::Asc => (&card.asc_box, [255, 0, 255]),
            Self::RankSig => (&card.rank_sig_box, [255, 128, 0]),
            Self::Champion => (&card.champion_box, [128, 255, 255]),
        }
    }
}

const DOT_RADIUS: i64 = 15;

/// `pixels` is a packed RGB8 buffer of `width` x `height`.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_possible_wrap
)]
fn draw_dot(pixels: &mut [u8], width: u32, height: u32, (cx, cy): (f32, f32)) {
    let (cx, cy) = (cx as i64, cy as i64);
    for y in (cy - DOT_RADIUS).max(0)..=(cy + DOT_RADIUS).min(i64::from(height) - 1) {
        for x in (cx - DOT_RADIUS).max(0)..=(cx + DOT_RADIUS).min(i64::from(width) - 1) {
            if (x - cx).pow(2) + (y - cy).pow(2) <= DOT_RADIUS.pow(2) {
                let i = (y as usize * width as usize + x as usize) * 3;
                pixels[i..i + 3].copy_from_slice(&[255, 0, 0]);
            }
        }
    }
}

const GLYPH_SCALE: i64 = 5;

/// 3x5 bitmap rows, enough for a ratio such as `0.82`.
const fn glyph(c: char) -> [u8; 5] {
    match c {
        '0' => [0b111, 0b101, 0b101, 0b101, 0b111],
        '1' => [0b010, 0b110, 0b010, 0b010, 0b111],
        '2' => [0b111, 0b001, 0b111, 0b100, 0b111],
        '3' => [0b111, 0b001, 0b111, 0b001, 0b111],
        '4' => [0b101, 0b101, 0b111, 0b001, 0b001],
        '5' => [0b111, 0b100, 0b111, 0b001, 0b111],
        '6' => [0b111, 0b100, 0b111, 0b101, 0b111],
        '7' => [0b111, 0b001, 0b001, 0b001, 0b001],
        '8' => [0b111, 0b101, 0b111, 0b101, 0b111],
        '9' => [0b111, 0b101, 0b111, 0b001, 0b111],
        '.' => [0, 0, 0, 0, 0b010],
        'x' => [0, 0b101, 0b010, 0b101, 0],
        _ => [0; 5],
    }
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn fill_rect(
    pixels: &mut [u8],
    (width, height): (u32, u32),
    (x0, y0): (i64, i64),
    (w, h): (i64, i64),
    color: [u8; 3],
) {
    for y in y0.max(0)..(y0 + h).min(i64::from(height)) {
        for x in x0.max(0)..(x0 + w).min(i64::from(width)) {
            let i = (y as usize * width as usize + x as usize) * 3;
            pixels[i..i + 3].copy_from_slice(&color);
        }
    }
}

const BOX_THICKNESS: i64 = 1;

#[allow(clippy::cast_possible_truncation)]
fn draw_box(pixels: &mut [u8], size: (u32, u32), b: &BoundingBox, color: [u8; 3]) {
    let (x0, y0, x1, y1) = (
        b.left as i64 - 1,
        b.top as i64 - 1,
        b.right as i64 + 1,
        b.bottom as i64 + 1,
    );
    let t = BOX_THICKNESS;
    fill_rect(pixels, size, (x0, y0), (x1 - x0, t), color);
    fill_rect(pixels, size, (x0, y1 - t), (x1 - x0, t), color);
    fill_rect(pixels, size, (x0, y0), (t, y1 - y0), color);
    fill_rect(pixels, size, (x1 - t, y0), (t, y1 - y0), color);
}

/// White text on a black box, horizontally centred on `cx`, top edge at `top`.
#[allow(clippy::cast_possible_wrap)]
fn draw_text(pixels: &mut [u8], size: (u32, u32), text: &str, (cx, top): (i64, i64), scale: i64) {
    let advance = 4 * scale;
    let text_width = advance * text.len() as i64;
    let left = cx - text_width / 2;
    let pad = scale;
    fill_rect(
        pixels,
        size,
        (left - pad, top - pad),
        (text_width + pad, 5 * scale + 2 * pad),
        [0, 0, 0],
    );
    for (n, c) in text.chars().enumerate() {
        for (row, bits) in glyph(c).iter().enumerate() {
            for col in 0..3 {
                if bits >> (2 - col) & 1 == 1 {
                    let x = left + n as i64 * advance + col * scale;
                    let y = top + row as i64 * scale;
                    fill_rect(pixels, size, (x, y), (scale, scale), [255, 255, 255]);
                }
            }
        }
    }
}

/// Every raw YOLO box of a selected class, valid or not, gets its ratio under its centre.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn draw_ratios(pixels: &mut [u8], size: (u32, u32), boxes: &Boxes) {
    let coords = boxes.xyxy();
    let centers = boxes.xywh();
    for i in 0..boxes.len() {
        let c = coords.row(i);
        let ratio = calculate_ratio([c[0], c[1], c[2], c[3]]);
        let (cx, cy) = (centers[[i, 0]] as i64, centers[[i, 1]] as i64);
        draw_text(
            pixels,
            size,
            &format!("{ratio:.2}"),
            (cx, cy + DOT_RADIUS + 2 * GLYPH_SCALE),
            GLYPH_SCALE,
        );
    }
}

/// Every raw YOLO box of a selected kind gets its confidence centred above its top edge.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn draw_confidences(pixels: &mut [u8], size: (u32, u32), boxes: &Boxes, kinds: &[BoxKind]) {
    let coords = boxes.xyxy();
    let confidences = boxes.conf();
    let classes = boxes.cls();
    for i in 0..boxes.len() {
        let kind = match DetectionClass::try_from(classes[i] as usize) {
            Ok(DetectionClass::Card) => BoxKind::Card,
            Ok(DetectionClass::Stars) => BoxKind::Stars,
            Ok(DetectionClass::Text) => BoxKind::Text,
            Err(()) => continue,
        };
        if !kinds.contains(&kind) {
            continue;
        }
        let c = coords.row(i);
        draw_text(
            pixels,
            size,
            &format!("{:.2}", confidences[i]),
            (c[0].midpoint(c[2]) as i64, c[1] as i64 - 7 * DIGIT_SCALE),
            DIGIT_SCALE,
        );
    }
}

/// `WxH` in pixels, centred just inside the box's bottom edge.
#[allow(clippy::cast_possible_truncation)]
fn draw_dims(pixels: &mut [u8], size: (u32, u32), b: &BoundingBox) {
    draw_text(
        pixels,
        size,
        &format!("{:.0}x{:.0}", b.right - b.left, b.bottom - b.top),
        (
            b.left.midpoint(b.right) as i64,
            b.bottom as i64 - 6 * DIGIT_SCALE,
        ),
        DIGIT_SCALE,
    );
}

const LABEL_CLASS: usize = 10;
const DIGIT_SCALE: i64 = 2;

/// Each digit box moved from its rank/sig crop back onto the screenshot, its class
/// above it; label glyphs in red. `digits[i]` is the reading of `cards[i]`.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
fn draw_digits(
    pixels: &mut [u8],
    size: (u32, u32),
    cards: &[CardDetected],
    digits: &[Vec<Results>],
) {
    for (card, results) in cards.iter().zip(digits) {
        // `crop` truncates its origin to whole pixels, so the offset does too.
        let (dx, dy) = (
            card.rank_sig_box.left as u32 as f32,
            card.rank_sig_box.top as u32 as f32,
        );
        for boxes in results.iter().filter_map(|r| r.boxes.as_ref()) {
            let coords = boxes.xyxy();
            let classes = boxes.cls();
            for i in 0..boxes.len() {
                let c = coords.row(i);
                let b = BoundingBox {
                    left: c[0] + dx,
                    top: c[1] + dy,
                    right: c[2] + dx,
                    bottom: c[3] + dy,
                };
                let class = classes[i] as usize;
                if class == LABEL_CLASS {
                    draw_box(pixels, size, &b, [255, 0, 0]);
                    continue;
                }
                draw_box(pixels, size, &b, [0, 255, 0]);
                draw_text(
                    pixels,
                    size,
                    &class.to_string(),
                    (b.center().0 as i64, b.top as i64 - 7 * DIGIT_SCALE),
                    DIGIT_SCALE,
                );
            }
        }
    }
}

const MATCH: [u8; 3] = [0, 255, 0];
const MISMATCH: [u8; 3] = [255, 0, 0];
const NO_GT: [u8; 3] = [160, 160, 160];
const MATRIX_BORDER: u8 = 4;

/// Each card beside its reading: the gallery band its name came from, then the fields.
/// Green when it matches the GT cell, red with the GT value of every wrong field,
/// grey without a GT cell.
pub fn draw_matrix(
    shot: &RgbImage,
    card_matrix: &Matrix,
    gt: Option<&Map<String, Value>>,
    bands: &HashMap<String, RgbImage>,
) -> anyhow::Result<RgbImage> {
    let font_path = check_font("Arial.ttf").context("Arial.ttf neither cached nor downloadable")?;
    let font_data = std::fs::read(font_path)?;
    let font = FontRef::try_from_slice(&font_data)?;
    let (width, height) = shot.dimensions();
    let mut out = RgbImage::new(width, 2 * height);
    imageops::replace(&mut out, shot, 0, 0);
    let size = out.dimensions();
    let or_unknown = |v: Option<u8>| v.map_or_else(|| "?".to_owned(), |v| v.to_string());
    for (cell, card) in card_matrix.cells() {
        {
            let mut lines = vec![
                (
                    card.champion_name.clone().unwrap_or_else(|| "?".to_owned()),
                    [255, 255, 255],
                ),
                (
                    format!(
                        "{}* R{} S{} A{}",
                        card.stars,
                        or_unknown(card.rank),
                        or_unknown(card.sig),
                        or_unknown(card.ascension)
                    ),
                    [255, 255, 255],
                ),
            ];
            let color = gt
                .and_then(|cells| cells.get(&cell))
                .map_or(NO_GT, |truth| {
                    let wrong: Vec<_> = gt::FIELDS
                        .iter()
                        .zip(gt::readings(card))
                        .filter(|(field, got)| !gt::same(got, &truth[**field]))
                        .map(|(field, _)| (format!("GT {field} {}", truth[*field]), MISMATCH))
                        .collect();
                    let color = if wrong.is_empty() { MATCH } else { MISMATCH };
                    lines.extend(wrong);
                    color
                });
            #[allow(clippy::cast_precision_loss)]
            let below = |b: BoundingBox, bands_down: u32| BoundingBox {
                top: b.top + (bands_down * height) as f32,
                bottom: b.bottom + (bands_down * height) as f32,
                ..b
            };
            let shot_box = *card.card_box;
            let portrait_box = below(*card.champion_box, 1);
            if let Some(band) = card.champion_name.as_ref().and_then(|name| bands.get(name)) {
                paste_band(&mut out, band, &portrait_box);
            }
            let text_box = BoundingBox {
                top: portrait_box.bottom,
                ..below(shot_box, 1)
            };
            for b in [shot_box, below(shot_box, 1)] {
                for t in 0..MATRIX_BORDER {
                    let t = f32::from(t);
                    let grown = BoundingBox {
                        left: b.left - t,
                        top: b.top - t,
                        right: b.right + t,
                        bottom: b.bottom + t,
                    };
                    draw_box(&mut out, size, &grown, color);
                }
            }
            draw_lines(&mut out, &font, &text_box, &lines);
        }
    }
    Ok(pair_up(&out, height, card_matrix))
}

const MAX_WIDTH: u32 = 2000;
const MARGIN: u32 = 20;
const PAIR_GAP: u32 = 4;

/// Each card cut from the shot beside its reading, pairs in reading order. A matrix row starts
/// a line and splits into even lines under `MAX_WIDTH`; nothing is resized.
fn pair_up(out: &RgbImage, half_height: u32, card_matrix: &Matrix) -> RgbImage {
    let rows: Vec<Vec<_>> = card_matrix
        .matrix
        .iter()
        .map(|row| {
            row.iter()
                .map(|(_, card)| tile_rect(&card.card_box, out.width(), half_height))
                .collect()
        })
        .collect();
    let (tile_w, tile_h) = rows
        .iter()
        .flatten()
        .fold((0, 0), |(w, h), &(_, _, rw, rh)| (w.max(rw), h.max(rh)));
    if tile_w == 0 {
        return out.clone();
    }
    let pair_w = 2 * tile_w + PAIR_GAP;
    let max_per_line = (MAX_WIDTH.saturating_sub(MARGIN) / (pair_w + MARGIN)).max(1) as usize;
    let lines: Vec<_> = rows
        .iter()
        .filter(|row| !row.is_empty())
        .flat_map(|row| row.chunks(row.len().div_ceil(row.len().div_ceil(max_per_line))))
        .collect();
    let longest = lines.iter().map(|line| line.len()).max().unwrap_or(1);
    let (Ok(longest), Ok(count)) = (u32::try_from(longest), u32::try_from(lines.len())) else {
        return out.clone();
    };
    let mut sheet = RgbImage::new(
        longest * (pair_w + MARGIN) + MARGIN,
        count * (tile_h + MARGIN) + MARGIN,
    );
    for (y, line) in (0..).zip(&lines) {
        for (x, &(left, top, w, h)) in (0..).zip(*line) {
            let (dx, dy) = (
                MARGIN + x * (pair_w + MARGIN),
                MARGIN + y * (tile_h + MARGIN),
            );
            let seen = imageops::crop_imm(out, left, top, w, h).to_image();
            let read = imageops::crop_imm(out, left, top + half_height, w, h).to_image();
            imageops::replace(&mut sheet, &seen, i64::from(dx), i64::from(dy));
            imageops::replace(
                &mut sheet,
                &read,
                i64::from(dx + tile_w + PAIR_GAP),
                i64::from(dy),
            );
        }
    }
    sheet
}

/// The card box with its border, clamped to the shot, as x, y, width, height.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn tile_rect(b: &BoundingBox, width: u32, height: u32) -> (u32, u32, u32, u32) {
    let border = f32::from(MATRIX_BORDER);
    let (x, y) = (
        (b.left - border).max(0.0) as u32,
        (b.top - border).max(0.0) as u32,
    );
    let right = ((b.right + border).ceil().max(0.0) as u32).min(width);
    let bottom = ((b.bottom + border).ceil().max(0.0) as u32).min(height);
    (x, y, right.saturating_sub(x), bottom.saturating_sub(y))
}

/// The band at the box's width, bottom on the box's bottom: a box the row fit cut short loses
/// the band's top, as the mosaic did.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
fn paste_band(out: &mut RgbImage, band: &RgbImage, b: &BoundingBox) {
    let w = b.width().round().max(1.0) as u32;
    let h = (band.height() as f32 * w as f32 / band.width() as f32).round() as u32;
    let resized = imageops::resize(band, w, h, imageops::FilterType::Triangle);
    let visible = (b.height().round() as u32).min(h);
    let kept = imageops::crop_imm(&resized, 0, h - visible, w, visible).to_image();
    imageops::replace(
        out,
        &kept,
        i64::from(b.left as u32),
        (b.bottom - visible as f32) as i64,
    );
}

/// Stacked from the box's top, sized so every line fits the box's height, each shrunk to its width.
#[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
fn draw_lines(out: &mut RgbImage, font: &FontRef, b: &BoundingBox, lines: &[(String, [u8; 3])]) {
    const LINE_SPACING: f32 = 1.15;
    let pad = b.width() / 20.0;
    let room = 2.0f32.mul_add(-pad, b.width());
    let line_px = (b.width() / 7.0)
        .min(2.0f32.mul_add(-pad, b.height()) / (lines.len() as f32 * LINE_SPACING));
    let mut y = b.top + pad;
    for (text, color) in lines {
        let mut px = line_px;
        let (text_width, _) = text_size(PxScale::from(px), font, text);
        if text_width as f32 > room {
            px *= room / text_width as f32;
        }
        draw_text_mut(
            out,
            Rgb(*color),
            (b.left + pad) as i32,
            y as i32,
            PxScale::from(px),
            font,
            text,
        );
        y += line_px * LINE_SPACING;
    }
}

/// Draws the requested layers, except `Yolo`, which is the base image itself.
pub fn draw_overlays(
    pixels: &mut [u8],
    (width, height): (u32, u32),
    overlays: &[Overlay],
    kinds: &[BoxKind],
    valid_cards: &[CardDetected],
    boxes: &Boxes,
    digits: &[Vec<Results>],
) {
    if overlays.contains(&Overlay::Dots) {
        for card in valid_cards {
            draw_dot(pixels, width, height, card.card_box.center());
        }
    }
    if overlays.contains(&Overlay::Ratio) {
        draw_ratios(pixels, (width, height), boxes);
    }
    if overlays.contains(&Overlay::Boxes) {
        for card in valid_cards {
            for kind in kinds {
                let (b, color) = kind.of(card);
                draw_box(pixels, (width, height), b, color);
            }
        }
        draw_confidences(pixels, (width, height), boxes, kinds);
    }
    if overlays.contains(&Overlay::Dims) {
        for card in valid_cards {
            for kind in kinds {
                draw_dims(pixels, (width, height), kind.of(card).0);
            }
        }
    }
    if overlays.contains(&Overlay::Digits) {
        draw_digits(pixels, (width, height), valid_cards, digits);
    }
}
