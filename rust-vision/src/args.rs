use std::num::ParseIntError;
use std::ops::RangeInclusive;
use std::path::Path;

use anyhow::{Result, bail};
use clap::{CommandFactory, Parser, ValueEnum, error::ErrorKind};

use crate::draw::{BoxKind, Overlay};

#[derive(Parser)]
#[command(
    about = "Run the pipeline over data/real, score it against the GT and write debug overlays"
)]
#[allow(clippy::struct_excessive_bools)]
struct Cli {
    /// Shot numbers or ranges (`4,12 1000-1010`) [default: every shot]
    #[arg(value_delimiter = ',', value_parser = shot_range)]
    shots: Vec<RangeInclusive<u32>>,
    /// Overlays to draw, comma-separated
    #[arg(short, long, value_delimiter = ',', default_value = "yolo")]
    overlay: Vec<Overlay>,
    /// Every overlay but `yolo`, which `boxes` replaces
    #[arg(short = 'a', long, conflicts_with = "overlay")]
    all_overlays: bool,
    /// Boxes the `boxes` and `dims` overlays draw, comma-separated [default: all]
    #[arg(short, long = "box", value_delimiter = ',')]
    boxes: Vec<BoxKind>,
    /// Score only, write nothing to out/debug
    #[arg(long, conflicts_with_all = ["overlay", "all_overlays", "boxes"])]
    no_save: bool,
    /// Rewrite the shots' GT from this run as an unverified draft, instead of scoring it
    #[arg(long)]
    bootstrap: bool,
    /// Mark the shots' GT `_verified: true`, without running anything
    #[arg(long, conflicts_with_all = ["bootstrap", "overlay", "all_overlays", "boxes", "no_save"])]
    validate: bool,
}

pub struct Args {
    pub paths: Vec<String>,
    pub overlays: Vec<Overlay>,
    pub boxes: Vec<BoxKind>,
    pub save_image: bool,
    pub is_bootstrap: bool,
    pub is_validate: bool,
}

impl Args {
    pub fn parse() -> Result<Self> {
        let cli = Cli::parse();
        let overlays = if cli.all_overlays {
            Overlay::value_variants()
                .iter()
                .copied()
                .filter(|&o| o != Overlay::Yolo)
                .collect()
        } else {
            cli.overlay
        };
        if overlays.contains(&Overlay::Yolo) && overlays.contains(&Overlay::Boxes) {
            Cli::command()
                .error(
                    ErrorKind::ArgumentConflict,
                    "overlays `yolo` and `boxes` draw the same cards: pick one",
                )
                .exit();
        }
        if !cli.boxes.is_empty()
            && !overlays
                .iter()
                .any(|o| matches!(o, Overlay::Boxes | Overlay::Dims))
        {
            Cli::command()
                .error(
                    ErrorKind::MissingRequiredArgument,
                    "--box only filters the `boxes` and `dims` overlays: add one of them",
                )
                .exit();
        }
        let boxes = if cli.boxes.is_empty() {
            BoxKind::value_variants().to_vec()
        } else {
            cli.boxes
        };
        Ok(Self {
            paths: selected_paths(&cli.shots)?,
            overlays,
            boxes,
            save_image: !cli.no_save,
            is_bootstrap: cli.bootstrap,
            is_validate: cli.validate,
        })
    }
}

fn selected_paths(wanted: &[RangeInclusive<u32>]) -> Result<Vec<String>> {
    let mut paths: Vec<String> = std::fs::read_dir(mcoc_vision::config::REAL_DIR)?
        .filter_map(|e| e.ok()?.path().to_str().map(String::from))
        .filter(|p| p.ends_with(".png") || p.ends_with(".jpg"))
        .collect();
    paths.sort();
    if !wanted.is_empty() {
        paths.retain(|p| shot_number(p).is_some_and(|n| wanted.iter().any(|r| r.contains(&n))));
        if paths.is_empty() {
            bail!("no image matching those shots in {}", mcoc_vision::config::REAL_DIR);
        }
    }
    Ok(paths)
}

/// `4`, or `1-100` with both ends included.
fn shot_range(elem: &str) -> Result<RangeInclusive<u32>, ParseIntError> {
    let (start, end) = elem.split_once('-').unwrap_or((elem, elem));
    Ok(start.trim().parse()?..=end.trim().parse()?)
}

/// `data/real/shot_0007.jpg` → 7.
fn shot_number(path: &str) -> Option<u32> {
    Path::new(path)
        .file_stem()?
        .to_str()?
        .strip_prefix("shot_")?
        .parse()
        .ok()
}
