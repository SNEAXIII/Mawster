mod args;
mod debug;
mod draw;
mod gt;

use args::Args;
use draw::{Overlay, draw_overlays};
use mcoc_vision::{
    config::{GalleryConfig, ModelPaths, get_digits_config, get_yolo_config},
    gallery,
    pipeline::{Laps, Matrix},
};
use ultralytics_inference::{
    YOLOModel,
    annotate::{annotate_image, load_image},
};

use crate::{
    debug::{get_and_create_debug_path, stem, write_rust_cards},
    gt::{Score, bootstrap, cells, validate},
};

fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let Args {
        paths,
        overlays,
        boxes: box_kinds,
        save_image,
        is_bootstrap,
        is_validate,
    } = Args::parse()?;
    if is_validate {
        return paths.iter().try_for_each(|path| validate(stem(path)));
    }
    let models = ModelPaths::from_env();
    let gallery_config = GalleryConfig::default();
    let gallery = gallery::load(&models.gallery)?;
    let mut yolo_area = YOLOModel::load_with_config(&models.detector, get_yolo_config(0.7, 0.1))?;
    let mut yolo_digits = YOLOModel::load_with_config(&models.digits, get_digits_config(0.7, 0.1))?;
    let mut score = Score::default();
    // One image at a time: decoding the whole set up front cost ~15 MB per shot.
    let mut samples: Vec<(&str, Vec<f64>)> = Vec::new();
    let mut totals = Vec::new();
    for path in &paths {
        let image = load_image(path)?;
        // Decoding the file is the caller's I/O, not the pipeline: timed from here.
        let mut laps = Laps::default();
        let (card_matrix, raw) = Matrix::with_raw(
            &image,
            &mut yolo_area,
            &mut yolo_digits,
            &gallery,
            &mut laps,
        )?;
        totals.push(print_laps(stem(path), &laps.steps));
        for &(name, ms) in &laps.steps {
            match samples.iter_mut().find(|(n, _)| *n == name) {
                Some((_, v)) => v.push(ms),
                None => samples.push((name, vec![ms])),
            }
        }
        let Some((result, boxes)) = raw.yolo.as_ref().and_then(|r| Some((r, r.boxes.as_ref()?)))
        else {
            if !is_bootstrap {
                score.add(stem(path), &card_matrix)?;
            }
            continue;
        };
        println!("{} cartes détectées", card_matrix.cards().count());
        if is_bootstrap {
            bootstrap(stem(path), &card_matrix)?;
        } else {
            score.add(stem(path), &card_matrix)?;
        }

        if !save_image {
            continue;
        }
        write_rust_cards(path, &card_matrix)?;
        let debug_path = get_and_create_debug_path(path)?;
        // The exact pixels the digit reader is handed, one file per cell.
        for (cell, card) in card_matrix.cells() {
            card.rank_sig_box
                .crop(&image)
                .save(debug_path.with_file_name(format!("band_{cell}.png")))?;
        }
        let mut canvas = if overlays.contains(&Overlay::Yolo) {
            annotate_image(&image, result, None).to_rgb8()
        } else {
            image.to_rgb8()
        };
        let size = canvas.dimensions();
        draw_overlays(
            &mut canvas,
            size,
            &overlays,
            &box_kinds,
            &card_matrix.cards().cloned().collect::<Vec<_>>(),
            boxes,
            &raw.digits,
        );
        if overlays.contains(&Overlay::Matrix) {
            let names: Vec<&str> = card_matrix
                .cards()
                .filter_map(|card| card.champion_name.as_deref())
                .collect();
            let gt_cells = cells(stem(path));
            canvas = draw::draw_matrix(
                &canvas,
                &card_matrix,
                gt_cells.as_ref(),
                &gallery::bands(&gallery_config, &names)?,
            )?;
        }
        canvas.save(&debug_path)?;
        println!(
            "{path} -> {} (debug draw+save {:.1} ms)",
            debug_path.display(),
            laps.lap("debug")
        );
    }
    samples.push(("TOTAL", totals));
    print_summary(&samples);
    if is_bootstrap { Ok(()) } else { score.check() }
}

/// One line: the pipeline's total, then every step. Returns the total.
fn print_laps(label: &str, steps: &[(&str, f64)]) -> f64 {
    let total: f64 = steps.iter().map(|(_, ms)| ms).sum();
    let detail: Vec<String> = steps.iter().map(|(n, ms)| format!("{n} {ms:.1}")).collect();
    println!("⏱ {label}: {total:.1} ms | {}", detail.join(" | "));
    total
}

/// Mean, min and max of every step over the run, in ms; `n` is how many shots ran the step.
#[allow(clippy::cast_precision_loss)]
fn print_summary(samples: &[(&str, Vec<f64>)]) {
    let header = "step (ms)";
    let width = samples
        .iter()
        .map(|(name, _)| name.len())
        .chain([header.len()])
        .max()
        .unwrap_or_default();
    println!(
        "\n{header:<width$} {:>8} {:>8} {:>8} {:>5}",
        "mean", "min", "max", "n"
    );
    for (name, v) in samples.iter().filter(|(_, v)| !v.is_empty()) {
        let mean = v.iter().sum::<f64>() / v.len() as f64;
        let (min, max) = v
            .iter()
            .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), &x| {
                (lo.min(x), hi.max(x))
            });
        println!(
            "{name:<width$} {mean:>8.1} {min:>8.1} {max:>8.1} {:>5}",
            v.len()
        );
    }
}
