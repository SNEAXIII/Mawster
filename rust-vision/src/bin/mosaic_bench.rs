//! Recall of the mosaic embedding on the Rust detector's portrait boxes, against the verified GT.
//! Grades the shots `cargo run` left a report for (`out/debug/<stem>/rust_cards.json`, see `RUST_CARDS`).
use anyhow::{Context, Result};
use image::{DynamicImage, RgbImage, imageops};
use mcoc_vision::{
    config::{GalleryConfig, REAL_DIR},
    gallery::{self, Entry, SUSPICIOUS_MARGIN},
    mosaic,
};
use serde_json::Value;
use std::{fs, path::Path, time::Instant};

/// Box offsets tried per query, as a fraction of its width and height; the best score wins.
const SHIFTS: [(&str, &[f32]); 2] = [("no shift", &[0.0]), ("±2 %", &[-0.02, 0.0, 0.02])];

/// Written by the detector binary per screenshot: `[{"cell": "r0c3", "portrait": [x1, y1, x2, y2]}, …]`.
const RUST_CARDS: &str = "rust_cards.json";

fn read_json(path: &Path) -> Result<Value> {
    let text = fs::read_to_string(path).with_context(|| path.display().to_string())?;
    Ok(serde_json::from_str(&text)?)
}

/// The setting whose misses get a debug sheet in `DEBUG_DIR`.
const DEBUG_SETTING: &str = "no shift";
const DEBUG_DIR: &str = "out/debug/mosaic";
const TILE_WIDTH: u32 = 240;
const TILE_HEIGHT: u32 = 140;
const GAP: u32 = 8;

/// The portrait box moved by `dx`, `dy` of its width and height.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn crop(img: &RgbImage, portrait: [f32; 4], dx: f32, dy: f32) -> RgbImage {
    let (w, h) = (portrait[2] - portrait[0], portrait[3] - portrait[1]);
    let x = dx.mul_add(w, portrait[0]).max(0.0) as u32;
    let y = dy.mul_add(h, portrait[1]).max(0.0) as u32;
    imageops::crop_imm(img, x, y, w as u32, h as u32).to_image()
}

fn query_features(img: &RgbImage, portrait: [f32; 4], shifts: &[f32]) -> Vec<Vec<f32>> {
    shifts
        .iter()
        .flat_map(|&dx| {
            shifts
                .iter()
                .map(move |&dy| mosaic::embed(&crop(img, portrait, dx, dy)))
        })
        .collect()
}

/// The query normalised over each champion's foreground in turn, for the whole gallery.
fn rank_masked(gallery: &[Entry], img: &RgbImage, portrait: [f32; 4]) -> Vec<(usize, f32)> {
    let query = mosaic::inner_cells(&crop(img, portrait, 0.0, 0.0));
    let mut scores: Vec<(usize, f32)> = gallery
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            (
                index,
                mosaic::compare_masked(&query, &entry.masked, &entry.mask),
            )
        })
        .collect();
    scores.sort_by(|a, b| b.1.total_cmp(&a.1));
    scores
}

/// Plain margins under which `gallery::rank` re-scores the shortlist on the foregrounds;
/// infinity always does.
const MASKED_MARGINS: [f32; 5] = [0.05, 0.10, 0.15, 0.20, f32::INFINITY];

/// A champion's score is its best match over the shifted crops.
fn best_score(queries: &[Vec<f32>], embedding: &[f32]) -> f32 {
    queries
        .iter()
        .map(|query| mosaic::compare(query, embedding))
        .fold(f32::MIN, f32::max)
}

/// Gallery indices by descending score.
fn rank(gallery: &[Entry], queries: &[Vec<f32>]) -> Vec<(usize, f32)> {
    let mut scores: Vec<(usize, f32)> = gallery
        .iter()
        .enumerate()
        .map(|(index, entry)| (index, best_score(queries, &entry.plain)))
        .collect();
    scores.sort_by(|a, b| b.1.total_cmp(&a.1));
    scores
}

/// Paints a normalised embedding back as an image: grey is the channel's mean,
/// brighter and darker are what the comparison actually sees.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn render_embedding(values: &[f32]) -> RgbImage {
    let height = u32::try_from(values.len() / (3 * mosaic::KEPT_WIDTH as usize)).unwrap_or(0);
    let largest = values
        .iter()
        .fold(0.0_f32, |acc, value| acc.max(value.abs()))
        + 1e-6;
    let pixels = values
        .iter()
        .map(|value| (128.0 + 127.0 * value / largest) as u8)
        .collect();
    RgbImage::from_raw(mosaic::KEPT_WIDTH, height, pixels).unwrap_or_default()
}

/// One sheet row: the image, the raw mosaic rows it covers, and their normalised inner cells.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn debug_row(image: &RgbImage) -> [RgbImage; 3] {
    let fit = |small: &RgbImage, filter| {
        DynamicImage::ImageRgb8(small.clone())
            .resize(TILE_WIDTH, TILE_HEIGHT, filter)
            .to_rgb8()
    };
    let enlarge = |small: &RgbImage| fit(small, imageops::FilterType::Nearest);
    let (rows, values) = mosaic::shrink_to_mosaic(image);
    let raw_pixels = values.iter().map(|&value| value as u8).collect();
    let raw_mosaic = RgbImage::from_raw(mosaic::MOSAIC_WIDTH, rows, raw_pixels).unwrap_or_default();
    [
        fit(image, imageops::FilterType::Triangle),
        enlarge(&raw_mosaic),
        enlarge(&render_embedding(&mosaic::embed(image))),
    ]
}

/// Rows top to bottom: the card's crop, the champion picked, the right champion.
fn write_debug_sheet(path: &Path, images: &[&RgbImage]) -> Result<()> {
    let row_count = u32::try_from(images.len())?;
    let mut sheet = RgbImage::new(
        3 * TILE_WIDTH + 2 * GAP,
        row_count * TILE_HEIGHT + (row_count - 1) * GAP,
    );
    for (row, image) in (0..).zip(images) {
        for (column, tile) in (0..).zip(debug_row(image)) {
            let x = i64::from(column * (TILE_WIDTH + GAP));
            let y = i64::from(row * (TILE_HEIGHT + GAP));
            imageops::replace(&mut sheet, &tile, x, y);
        }
    }
    sheet.save(path)?;
    Ok(())
}

fn write_miss(
    gallery: &[Entry],
    bands: &[RgbImage],
    ranked: &[(usize, f32)],
    screenshot: &RgbImage,
    portrait: [f32; 4],
    truth: &str,
    card_id: &str,
) -> Result<()> {
    let crop = crop(screenshot, portrait, 0.0, 0.0);
    let (picked, picked_score) = ranked[0];
    let Some(&(right, right_score)) = ranked
        .iter()
        .find(|(index, _)| gallery[*index].name.eq_ignore_ascii_case(truth))
    else {
        return Ok(());
    };
    fs::create_dir_all(DEBUG_DIR)?;
    let path = Path::new(DEBUG_DIR).join(format!("{card_id}.png"));
    write_debug_sheet(&path, &[&crop, &bands[picked], &bands[right]])?;
    println!(
        "  {}: picked {} {picked_score:.3}, right {truth} {right_score:.3}",
        path.display(),
        gallery[picked].name
    );
    Ok(())
}

struct Tally {
    hits: usize,
    hits5: usize,
    margin: f32,
    /// The smallest top1 − top2 gap seen, and on which card.
    closest: (f32, String),
    secs: f64,
    errors: Vec<String>,
}

impl Default for Tally {
    fn default() -> Self {
        Self {
            hits: 0,
            hits5: 0,
            margin: 0.0,
            closest: (f32::MAX, String::new()),
            secs: 0.0,
            errors: Vec::new(),
        }
    }
}

impl Tally {
    /// Counts one card's ranking; says whether the first pick was right.
    fn record(
        &mut self,
        gallery: &[Entry],
        ranked: &[(usize, f32)],
        card: &str,
        truth: &str,
    ) -> bool {
        let pred = &gallery[ranked[0].0].name;
        let margin = ranked[0].1 - ranked[1].1;
        self.margin += margin;
        if margin < self.closest.0 {
            let runner_up = &gallery[ranked[1].0].name;
            self.closest = (margin, format!("{card}: {pred} over {runner_up}"));
        }
        self.hits5 += usize::from(
            ranked[..5]
                .iter()
                .any(|(i, _)| gallery[*i].name.eq_ignore_ascii_case(truth)),
        );
        let hit = pred.eq_ignore_ascii_case(truth);
        if hit {
            self.hits += 1;
        } else {
            self.errors.push(format!("{card}: {truth} -> {pred}"));
        }
        hit
    }
}

#[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]
fn main() -> Result<()> {
    let start = Instant::now();
    let (gallery, bands): (Vec<Entry>, Vec<RgbImage>) = gallery::build(&GalleryConfig::default())?
        .into_iter()
        .unzip();
    println!(
        "gallery: {} portraits in {:.2?}",
        gallery.len(),
        start.elapsed()
    );

    let mut tallies: Vec<Tally> = SHIFTS.iter().map(|_| Tally::default()).collect();
    let mut masked = Tally::default();
    let mut masked_cascades: Vec<(Tally, usize)> = MASKED_MARGINS
        .iter()
        .map(|_| (Tally::default(), 0))
        .collect();
    let mut cards = 0_u32;
    let mut gt_paths: Vec<_> = fs::read_dir(REAL_DIR)?
        .filter_map(|e| Some(e.ok()?.path()))
        .filter(|p| p.to_string_lossy().ends_with(".gt.json"))
        .collect();
    gt_paths.sort();
    for gt_path in gt_paths {
        let gt = read_json(&gt_path)?;
        if gt["_verified"] != Value::Bool(true) {
            continue;
        }
        let file_name = gt_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        let stem = file_name.trim_end_matches(".gt.json");
        let report = Path::new("out/debug").join(stem).join(RUST_CARDS);
        if !report.exists() {
            continue;
        }
        let rust_cards = read_json(&report)?;
        let img_path = ["png", "jpg"]
            .iter()
            .map(|ext| Path::new(REAL_DIR).join(format!("{stem}.{ext}")))
            .find(|p| p.exists())
            .context("screenshot missing")?;
        let img = image::open(img_path)?.to_rgb8();
        for card in rust_cards.as_array().context("no cards")? {
            let cell = card["cell"].as_str().unwrap_or_default();
            let Some(truth) = gt["cells"][cell]["name"].as_str() else {
                continue;
            };
            let Some(b) = card["portrait"].as_array() else {
                continue;
            };
            let b: Vec<f32> = b
                .iter()
                .filter_map(|v| v.as_f64().map(|x| x as f32))
                .collect();
            let b = [b[0], b[1], b[2], b[3]];
            cards += 1;
            let card_id = format!("{stem} {cell}");
            let t0 = Instant::now();
            let ranked = rank_masked(&gallery, &img, b);
            masked.secs += t0.elapsed().as_secs_f64();
            masked.record(&gallery, &ranked, &card_id, truth);
            for (min_margin, (t, reranked)) in MASKED_MARGINS.iter().zip(&mut masked_cascades) {
                let t0 = Instant::now();
                let (ranked, rescored) =
                    gallery::rank(&gallery, &crop(&img, b, 0.0, 0.0), *min_margin);
                t.secs += t0.elapsed().as_secs_f64();
                *reranked += usize::from(rescored);
                t.record(&gallery, &ranked, &card_id, truth);
            }
            for ((label, shifts), t) in SHIFTS.iter().zip(&mut tallies) {
                let t0 = Instant::now();
                let ranked = rank(&gallery, &query_features(&img, b, shifts));
                t.secs += t0.elapsed().as_secs_f64();
                if !t.record(&gallery, &ranked, &card_id, truth) && *label == DEBUG_SETTING {
                    let sheet = format!("{stem}_{cell}");
                    write_miss(&gallery, &bands, &ranked, &img, b, truth, &sheet)?;
                }
            }
        }
    }

    print_summary(cards, &tallies, &masked, &masked_cascades);
    Ok(())
}

#[allow(clippy::cast_precision_loss)]
fn print_summary(
    cards: u32,
    tallies: &[Tally],
    masked: &Tally,
    masked_cascades: &[(Tally, usize)],
) {
    println!(
        "mosaic {}*{}, border {}",
        mosaic::MOSAIC_WIDTH,
        mosaic::MOSAIC_HEIGHT,
        mosaic::BORDER_CELLS
    );

    let pct = |n: usize| 100.0 * n as f32 / cards as f32;
    println!("{cards} cards vs GT");
    let line = |label: String, t: &Tally| {
        println!(
            "mosaic {label:<24}: top1 {}/{cards} ({:.1} %) · top5 {:.1} % · margin {:.3} · {:.2} ms/card",
            t.hits,
            pct(t.hits),
            pct(t.hits5),
            t.margin / cards as f32,
            1000.0 * t.secs / f64::from(cards),
        );
        println!("    closest call {:.3} · {}", t.closest.0, t.closest.1);
    };
    for ((label, shifts), t) in SHIFTS.iter().zip(tallies) {
        line(format!("plain {label} ({} crops)", shifts.len().pow(2)), t);
    }
    line("masked, whole gallery".to_owned(), masked);
    for (min_margin, (t, reranked)) in MASKED_MARGINS.iter().zip(masked_cascades) {
        line(
            format!("masked if < {min_margin:.2} ({:.1} %)", pct(*reranked)),
            t,
        );
    }
    if let Some((_, (shipped, _))) = MASKED_MARGINS
        .iter()
        .zip(masked_cascades)
        .find(|(margin, _)| **margin == SUSPICIOUS_MARGIN)
    {
        println!("\nerrors of the shipped setting (masked if < {SUSPICIOUS_MARGIN:.2}):");
        shipped.errors.iter().for_each(|e| println!("  {e}"));
    }
}
