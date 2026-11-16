mod reader;
use crate::{config::GalleryConfig, gallery::reader::Reader, mosaic};
use anyhow::{Context, Result, ensure};
use image::{RgbImage, RgbaImage, imageops};
use serde_json::Value;
use std::{collections::HashMap, fs, path::Path};

/// Non-square portraits whose art is not the bottom-left square: stem, x, y, side.
const OFFSET_ART: [(&str, u32, u32, u32); 1] = [("bullseye", 26, 0, 534)];

/// Plain margin under which a naming is suspicious: the shortlist is then re-scored on the
/// champions' foregrounds, which a prismatic card background cannot sway.
pub const SUSPICIOUS_MARGIN: f32 = 0.10;
/// Plain candidates the foreground pass re-scores.
pub const SHORTLIST: usize = 5;

/// What the runtime names a champion with.
#[derive(Debug, PartialEq)]
pub struct Entry {
    pub name: String,
    /// Over the whole band, card background included (`mosaic::embed`).
    pub plain: Vec<f32>,
    /// Over its foreground only (`mosaic::embed_masked`).
    pub masked: Vec<f32>,
    pub mask: Vec<bool>,
}

/// Each entry with the band it was embedded from, kept for the debug sheets.
pub type Gallery = Vec<(Entry, RgbImage)>;

/// Gallery indices by descending score, plain first; under `suspicious_margin`, only the
/// shortlist comes back, re-scored on the foregrounds. Says whether it re-scored.
pub fn rank(
    entries: &[Entry],
    crop: &RgbImage,
    suspicious_margin: f32,
) -> (Vec<(usize, f32)>, bool) {
    let query = mosaic::embed(crop);
    let plain = sorted(
        entries
            .iter()
            .enumerate()
            .map(|(index, entry)| (index, mosaic::compare(&query, &entry.plain))),
    );
    if plain.len() < 2 || plain[0].1 - plain[1].1 >= suspicious_margin {
        return (plain, false);
    }
    let cells = mosaic::inner_cells(crop);
    let shortlist = plain.iter().take(SHORTLIST).map(|&(index, _)| {
        let entry = &entries[index];
        (
            index,
            mosaic::compare_masked(&cells, &entry.masked, &entry.mask),
        )
    });
    (sorted(shortlist), true)
}

fn sorted(scores: impl Iterator<Item = (usize, f32)>) -> Vec<(usize, f32)> {
    let mut scores: Vec<(usize, f32)> = scores.collect();
    scores.sort_by(|a, b| b.1.total_cmp(&a.1));
    scores
}

/// Portrait file stem → display name. A stem champions.json lacks stays out of the gallery.
fn names(path: &Path) -> Result<HashMap<String, String>> {
    let text = fs::read_to_string(path).with_context(|| path.display().to_string())?;
    let champions: Value = serde_json::from_str(&text)?;
    Ok(champions
        .as_array()
        .context("champions.json is not a list")?
        .iter()
        .filter_map(|c| {
            let stem = Path::new(c["image_url"].as_str()?).file_stem()?.to_str()?;
            Some((stem.to_owned(), c["name"].as_str()?.to_owned()))
        })
        .collect())
}

fn portrait_art(path: &Path) -> Result<RgbaImage> {
    let portrait = image::open(path)?.to_rgba8();
    let stem = path.file_stem().and_then(|s| s.to_str());
    Ok(
        match OFFSET_ART.iter().find(|(name, ..)| Some(*name) == stem) {
            Some(&(_, x, y, side)) => imageops::crop_imm(&portrait, x, y, side, side).to_image(),
            None => portrait,
        },
    )
}

fn card_background(config: &GalleryConfig) -> Result<RgbaImage> {
    let path = &config.card_background;
    let image = image::open(path).with_context(|| path.display().to_string())?;
    Ok(image.to_rgba8())
}

/// The band each name was embedded from, for the names whose portrait is on disk.
pub fn bands(config: &GalleryConfig, wanted: &[&str]) -> Result<HashMap<String, RgbImage>> {
    let stems: HashMap<String, String> = names(&config.champions)?
        .into_iter()
        .map(|(stem, name)| (name, stem))
        .collect();
    let card_bg = card_background(config)?;
    let mut out = HashMap::new();
    for &name in wanted {
        let stem = stems.get(name).map_or(name, String::as_str);
        if let Ok(portrait) = portrait_art(&config.portraits.join(format!("{stem}.png"))) {
            let band = mosaic::make_portrait_band_with_background(&portrait, &card_bg);
            out.insert(name.to_owned(), band);
        }
    }
    Ok(out)
}

pub fn build(config: &GalleryConfig) -> Result<Gallery> {
    let names = names(&config.champions)?;
    let card_bg = card_background(config)?;
    let mut paths: Vec<_> = fs::read_dir(&config.portraits)
        .with_context(|| config.portraits.display().to_string())?
        .filter_map(|e| Some(e.ok()?.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "png"))
        .collect();
    paths.sort();
    let mut out = Vec::new();
    for path in paths {
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        let Some(name) = names.get(stem).cloned() else {
            continue;
        };
        let portrait = portrait_art(&path)?;
        let band = mosaic::make_portrait_band_with_background(&portrait, &card_bg);
        let mask = mosaic::foreground(&portrait);
        let entry = Entry {
            name,
            plain: mosaic::embed(&band),
            masked: mosaic::embed_masked(&band, &mask),
            mask,
        };
        out.push((entry, band));
    }
    Ok(out)
}

/// Little-endian: the mosaic stamp, the entry count, then per entry its name, plain and masked
/// embeddings, and mask (a byte per cell), each prefixed with its length as a u32.
pub fn save(path: &Path, gallery: &Gallery) -> Result<()> {
    let mut bytes = Vec::new();
    put_bytes(&mut bytes, mosaic::stamp().as_bytes())?;
    put_len(&mut bytes, gallery.len())?;
    for (entry, _) in gallery {
        put_bytes(&mut bytes, entry.name.as_bytes())?;
        for embedding in [&entry.plain, &entry.masked] {
            put_len(&mut bytes, embedding.len())?;
            bytes.extend(embedding.iter().flat_map(|value| value.to_le_bytes()));
        }
        put_len(&mut bytes, entry.mask.len())?;
        bytes.extend(entry.mask.iter().map(|&kept| u8::from(kept)));
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, bytes).with_context(|| path.display().to_string())
}

fn put_len(bytes: &mut Vec<u8>, len: usize) -> Result<()> {
    bytes.extend(u32::try_from(len)?.to_le_bytes());
    Ok(())
}

fn put_bytes(bytes: &mut Vec<u8>, data: &[u8]) -> Result<()> {
    put_len(bytes, data.len())?;
    bytes.extend(data);
    Ok(())
}

/// Names and embeddings; refuses a file built under other mosaic settings.
pub fn load(path: &Path) -> Result<Vec<Entry>> {
    let bytes = fs::read(path).with_context(|| path.display().to_string())?;
    let mut reader = Reader::new(&bytes);
    let stamp = reader.string()?;
    ensure!(
        stamp == mosaic::stamp(),
        "{} was built for `{stamp}`, the mosaic is now `{}`: run build_gallery",
        path.display(),
        mosaic::stamp()
    );
    let count = reader.len()?;
    let mut entries = Vec::with_capacity(count);
    for _ in 0..count {
        let name = reader.string()?;
        let plain = reader.floats()?;
        let masked = reader.floats()?;
        let cells = reader.len()?;
        let mask = reader.take(cells)?.iter().map(|&byte| byte != 0).collect();
        entries.push(Entry {
            name,
            plain,
            masked,
            mask,
        });
    }
    ensure!(reader.0.is_empty(), "{}: trailing bytes", path.display());
    Ok(entries)
}
