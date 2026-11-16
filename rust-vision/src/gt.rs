//! Scores the detector's cards against `data/real/<stem>.gt.json`, cell by cell.
use mcoc_vision::{detection::CardDetected, pipeline::Matrix};
use serde_json::{Map, Value, json};
use std::path::Path;

pub const FIELDS: [&str; 5] = ["name", "stars", "rank", "sig", "ascension"];

/// What a card read, in `FIELDS` order.
pub fn readings(card: &CardDetected) -> [Value; FIELDS.len()] {
    [
        json!(card.champion_name),
        json!(card.stars),
        json!(card.rank),
        json!(card.sig),
        json!(card.ascension),
    ]
}

/// Exact parity: a name differing only by case is still a miss.
pub fn same(got: &Value, want: &Value) -> bool {
    got == want
}

/// The GT's cells, verified or not: checking a draft is when the matrix overlay helps most.
pub fn cells(stem: &str) -> Option<Map<String, Value>> {
    let mut gt: Value = serde_json::from_str(&std::fs::read_to_string(gt_path(stem)).ok()?).ok()?;
    match gt["cells"].take() {
        Value::Object(cells) => Some(cells),
        _ => None,
    }
}

#[derive(Default)]
pub struct Score {
    cells: usize,
    hits: [usize; FIELDS.len()],
    /// Detected cards the GT has no cell for.
    extra: Vec<String>,
    /// GT cells no card was detected in.
    missing: Vec<String>,
    /// Fields read differently from the GT.
    wrong: Vec<String>,
    /// Shots with no GT or an unverified one: reported, never a failure.
    skipped: Vec<String>,
    /// Weakest rank/sig digit of every verified cell found, `None` when none was read.
    digit_confidences: Vec<(String, Option<f32>)>,
}

impl Score {
    /// A GT cell with no card scores a miss on every field. Unverified GTs are skipped:
    /// one bootstrapped from a run agrees with that run's errors.
    pub fn add(&mut self, stem: &str, card_matrix: &Matrix) -> anyhow::Result<()> {
        let Ok(text) = std::fs::read_to_string(gt_path(stem)) else {
            self.skipped.push(format!("{stem}  WARN no GT"));
            return Ok(());
        };
        let gt: Value = serde_json::from_str(&text)?;
        let Some(cells) = gt["cells"].as_object().filter(|_| gt["_verified"] == true) else {
            self.skipped.push(format!("{stem}  WARN GT not verified"));
            return Ok(());
        };
        for (cell, card) in card_matrix.cells() {
            if !cells.contains_key(&cell) {
                let name = card.champion_name.as_deref().unwrap_or("?");
                self.extra.push(format!("{stem} {cell}  read as {name}"));
            }
        }
        for (cell, truth) in cells {
            self.cells += 1;
            let Some((_, card)) = card_matrix.cells().find(|(c, _)| c == cell) else {
                self.missing
                    .push(format!("{stem} {cell}  GT {}", truth["name"]));
                continue;
            };
            self.digit_confidences
                .push((format!("{stem} {cell}"), card.digit_confidence));
            let got = readings(card);
            for ((field, got), hits) in FIELDS.iter().zip(&got).zip(&mut self.hits) {
                let want = &truth[field];
                if same(got, want) {
                    *hits += 1;
                } else {
                    self.wrong
                        .push(format!("{stem} {cell} {field:<9}  GT {want}  read {got}"));
                }
            }
        }
        Ok(())
    }

    /// Prints the report; errs on any deviation from the GT.
    #[allow(clippy::cast_precision_loss)]
    pub fn check(&self) -> anyhow::Result<()> {
        self.print_digit_confidences();
        println!("\n=== GT report: {} verified cells ===", self.cells);
        for (field, hits) in FIELDS.iter().zip(self.hits) {
            let pct = 100.0 * hits as f32 / self.cells.max(1) as f32;
            println!("  {field:<9} {hits}/{} ({pct:.1} %)", self.cells);
        }
        for (title, lines) in [
            ("EXTRA cards (detected, not in GT)", &self.extra),
            ("MISSING cards (in GT, not detected)", &self.missing),
            ("WRONG fields", &self.wrong),
            ("SKIPPED shots", &self.skipped),
        ] {
            println!("\n{title}: {}", lines.len());
            for line in lines {
                println!("  {line}");
            }
        }
        anyhow::ensure!(
            self.cells > 0,
            "FAIL: no verified cell, nothing was checked"
        );
        anyhow::ensure!(
            self.extra.is_empty() && self.missing.is_empty() && self.wrong.is_empty(),
            "FAIL: {} extra, {} missing cards, {} wrong fields",
            self.extra.len(),
            self.missing.len(),
            self.wrong.len()
        );
        println!("\nPASS: every field of every verified cell matches the GT");
        Ok(())
    }

    /// Distribution of each cell's weakest digit: the margin a 100 % GT hides.
    #[allow(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss
    )]
    fn print_digit_confidences(&self) {
        let mut read: Vec<(&str, f32)> = self
            .digit_confidences
            .iter()
            .filter_map(|(cell, conf)| Some((cell.as_str(), (*conf)?)))
            .collect();
        read.sort_by(|a, b| a.1.total_cmp(&b.1));
        println!(
            "\nweakest digit per cell: {} read, {} without any digit",
            read.len(),
            self.digit_confidences.len() - read.len()
        );
        let Some(&(_, min)) = read.first() else {
            return;
        };
        let at = |q: f32| read[((read.len() - 1) as f32 * q).round() as usize].1;
        println!(
            "  min {min:.3}  p1 {:.3}  p5 {:.3}  p50 {:.3}  mean {:.3}",
            at(0.01),
            at(0.05),
            at(0.5),
            read.iter().map(|(_, c)| c).sum::<f32>() / read.len() as f32
        );
        for floor in [0.8, 0.9] {
            let below = read.iter().filter(|(_, c)| *c < floor).count();
            println!("  < {floor}: {below}");
        }
        for (cell, conf) in read.iter().take(5) {
            println!("  {conf:.3}  {cell}");
        }
    }
}

fn gt_path(stem: &str) -> std::path::PathBuf {
    Path::new(mcoc_vision::config::REAL_DIR).join(format!("{stem}.gt.json"))
}

/// Writes the GT from scratch out of this run, one cell per detected card; the old file is
/// ignored.
pub fn bootstrap(stem: &str, card_matrix: &Matrix) -> anyhow::Result<()> {
    let path = gt_path(stem);
    let mut cells = Map::new();
    for (cell, card) in card_matrix.cells() {
        cells.insert(
            cell,
            json!({
                "name": card.champion_name.as_deref().unwrap_or("?"),
                "stars": card.stars,
                "rank": card.rank,
                "sig": card.sig,
                "ascension": card.ascension,
            }),
        );
    }
    let count = cells.len();
    let draft = json!({
        "_verified": false,
        "_source": "DRAFT bootstrapped from a Rust run: every field is a guess. Confirm each \
            against the card, then set _verified: true.",
        "cells": cells,
    });
    std::fs::write(&path, serde_json::to_string_pretty(&draft)? + "\n")?;
    println!(
        "wrote {count} cells into {} (_verified: false)",
        path.display()
    );
    Ok(())
}

/// Flips an existing GT to `_verified: true`, nothing else.
pub fn validate(stem: &str) -> anyhow::Result<()> {
    let path = gt_path(stem);
    let mut gt: Value = serde_json::from_str(&std::fs::read_to_string(&path)?)?;
    gt["_verified"] = json!(true);
    std::fs::write(&path, serde_json::to_string_pretty(&gt)? + "\n")?;
    println!("{} -> _verified: true", path.display());
    Ok(())
}
