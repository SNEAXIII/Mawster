use std::fmt;

use image::DynamicImage;
use serde::Serialize;
use ultralytics_inference::{Results, YOLOModel};

use super::Laps;
use crate::{
    detection::{CardDetected, CardDetectedPrediction, extract_cards, read_detections},
    digits::read_rank_sig,
};

/// Rows top to bottom, each left to right, every card beside its grid column: a missed card
/// leaves a hole instead of shifting the rest of its row.
pub struct Matrix<'a> {
    pub matrix: Vec<Vec<(usize, CardDetected<'a>)>>,
    /// Wall time of each step, in ms, in run order.
    pub timings: Vec<(&'static str, f64)>,
}

/// What the debug overlays draw on top of the cards; the worker never needs it.
pub struct Raw {
    /// Detector output; `None` when YOLO returned nothing.
    pub yolo: Option<Results>,
    /// Digit reader output, one entry per card in reading order.
    pub digits: Vec<Vec<Results>>,
}
impl<'a> Matrix<'a> {
    pub fn new(
        image: &'a DynamicImage,
        yolo_area: &mut YOLOModel,
        yolo_digits: &mut YOLOModel,
        gallery: &[crate::gallery::Entry],
    ) -> anyhow::Result<Self> {
        let laps = &mut Laps::default();
        Ok(Self::with_raw(image, yolo_area, yolo_digits, gallery, laps)?.0)
    }

    /// The same run as `new`, plus the raw model outputs the bench draws and each step's time.
    pub fn with_raw(
        image: &'a DynamicImage,
        yolo_area: &mut YOLOModel,
        yolo_digits: &mut YOLOModel,
        gallery: &[crate::gallery::Entry],
        laps: &mut Laps,
    ) -> anyhow::Result<(Self, Raw)> {
        let yolo = Self::detect(image, yolo_area, laps)?;
        let Some(boxes) = yolo.as_ref().and_then(|r| r.boxes.as_ref()) else {
            let raw = Raw {
                yolo,
                digits: Vec::new(),
            };
            let matrix = Self {
                matrix: Vec::new(),
                timings: laps.steps.clone(),
            };
            return Ok((matrix, raw));
        };
        let detections = read_detections(boxes);
        laps.lap("detections");
        let mut valid_cards = extract_cards(detections, image);
        laps.lap("cards (build+stars)");
        valid_cards.iter_mut().for_each(CardDetected::set_ascension);
        laps.lap("asc");
        for card in &mut valid_cards {
            card.set_champion_name(gallery);
        }
        laps.lap("name");

        let mut matrix = Self::build_rows(&valid_cards);
        laps.lap("matrix");

        // Get ranks and sig
        let crops = matrix
            .iter()
            .flatten()
            .map(|card: &CardDetected| card.rank_sig_box.crop(image))
            .collect::<Vec<DynamicImage>>();
        laps.lap("digits crop");
        let digits = yolo_digits.predict_batch(&crops, &[])?;
        laps.lap("digits");
        let first = digits.first().and_then(|r| r.first());
        laps.split_model(
            ["digits pre", "digits infer", "digits post"],
            first,
            crops.len(),
        );
        for (card, results) in matrix.iter_mut().flatten().zip(&digits) {
            // `crop` truncates the band to whole pixels.
            (card.rank, card.sig) = read_rank_sig(results, card.rank_sig_box.width().trunc());
        }
        laps.lap("rank/sig");
        let centers: Vec<Vec<f32>> = matrix
            .iter()
            .map(|row| row.iter().map(|c| c.card_box.center().0).collect())
            .collect();
        let matrix = Self::grid_columns(&centers)
            .into_iter()
            .zip(matrix)
            .map(|(cols, row)| cols.into_iter().zip(row).collect())
            .collect();
        let timings = laps.steps.clone();
        Ok((Self { matrix, timings }, Raw { yolo, digits }))
    }

    /// No Lanczos pre-resize: only the end2end export needed it; the one-to-many export
    /// scores the same on the crate's bilinear resize, 27 ms faster.
    fn detect(
        image: &DynamicImage,
        yolo_area: &mut YOLOModel,
        laps: &mut Laps,
    ) -> anyhow::Result<Option<Results>> {
        let yolo = yolo_area
            .predict_image(image, String::new())?
            .into_iter()
            .next();
        laps.lap("yolo");
        laps.split_model(["yolo pre", "yolo infer", "yolo post"], yolo.as_ref(), 1);
        Ok(yolo)
    }

    /// Every card in reading order: rows top to bottom, each left to right.
    pub fn cards(&self) -> impl Iterator<Item = &CardDetected<'a>> {
        self.matrix.iter().flatten().map(|(_, card)| card)
    }

    /// Every card beside its ground-truth cell, `r{row}c{col}`, in reading order.
    pub fn cells(&self) -> impl Iterator<Item = (String, &CardDetected<'a>)> {
        self.matrix
            .iter()
            .enumerate()
            .flat_map(|(y, row)| row.iter().map(move |(x, card)| (format!("r{y}c{x}"), card)))
    }

    /// Holes in the grid: a column the shot has but a row lacks, found by position.
    pub fn missing_cells(&self) -> usize {
        let rows: Vec<Vec<usize>> = self
            .matrix
            .iter()
            .map(|row| row.iter().map(|(x, _)| *x).collect())
            .collect();
        count_missing_cells(&rows)
    }

    pub fn into_flat(self) -> Vec<CardDetected<'a>> {
        self.matrix
            .into_iter()
            .flatten()
            .map(|(_, card)| card)
            .collect()
    }

    /// Rows top to bottom, each sorted left to right.
    fn build_rows(cards: &[CardDetected<'a>]) -> Vec<Vec<CardDetected<'a>>> {
        let center_y = |c: &CardDetected| c.card_box.center().1;
        let mut cards = cards.to_vec();
        cards.sort_by(|a, b| center_y(a).total_cmp(&center_y(b)));
        let mut rows: Vec<Vec<CardDetected>> = Vec::new();
        for card in cards {
            if let Some(row) = rows.last_mut()
                && center_y(&card) - center_y(&row[0]) <= center_y(&row[0]) - row[0].card_box.top
            {
                row.push(card);
            } else {
                rows.push(vec![card]);
            }
        }
        for row in &mut rows {
            row.sort_by(|a, b| a.card_box.center().0.total_cmp(&b.card_box.center().0));
        }
        rows
    }

    /// Column of each card from its x centre, rows sorted left to right: the pitch is the smallest
    /// step between neighbours of a row, column 0 the leftmost card of the shot.
    // ponytail: a column missed in every row is invisible, so it shifts nothing only when another row has it.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    fn grid_columns(rows: &[Vec<f32>]) -> Vec<Vec<usize>> {
        let left = rows.iter().flatten().copied().fold(f32::INFINITY, f32::min);
        let pitch = rows
            .iter()
            .flat_map(|row| row.windows(2).map(|w| w[1] - w[0]))
            .fold(f32::INFINITY, f32::min);
        rows.iter()
            .map(|row| {
                row.iter()
                    .enumerate()
                    .map(|(i, x)| {
                        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                        if pitch.is_finite() {
                            ((x - left) / pitch).round() as usize
                        } else {
                            i
                        }
                    })
                    .collect()
            })
            .collect()
    }
}
/// Columns are positional, so every row but the last spans the widest one; the last row
/// may stop early, the roster just ends there. A whole missed row stays invisible.
fn count_missing_cells(rows: &[Vec<usize>]) -> usize {
    let Some(widest) = rows.iter().flatten().max().copied() else {
        return 0;
    };
    let last = rows.len() - 1;
    rows.iter()
        .enumerate()
        .map(|(y, columns)| {
            let end = if y == last {
                columns.iter().max().copied().unwrap_or(0)
            } else {
                widest
            };
            (0..=end).filter(|x| !columns.contains(x)).count()
        })
        .sum()
}

#[derive(Serialize)]
pub struct MatrixPrediction {
    pub count: usize,
    /// Lowest naming confidence of the shot; `None` without a card.
    pub worst_confidence: Option<f32>,
    pub missing_cells: usize,
    pub cells: Vec<(String, CardDetectedPrediction)>,
    pub timings: Vec<(&'static str, f64)>,
}
impl From<&Matrix<'_>> for MatrixPrediction {
    fn from(matrix: &Matrix<'_>) -> Self {
        let cells: Vec<(String, CardDetectedPrediction)> = matrix
            .cells()
            // 7★, or 6★ from rank 4; an unread rank stays, for the player to fix.
            .filter(|(_, card)| {
                card.stars > 6 || (card.stars == 6 && card.rank.is_none_or(|rank| rank >= 4))
            })
            .map(|(cell_name, card)| (cell_name, CardDetectedPrediction::from(card)))
            .collect();
        Self {
            count: cells.len(),
            worst_confidence: cells
                .iter()
                .map(|(_, card)| card.confidence)
                .min_by(f32::total_cmp),
            missing_cells: matrix.missing_cells(),
            cells,
            timings: matrix.timings.clone(),
        }
    }
}
/// The worker's log line: the cards themselves stay in the JSON.
impl fmt::Debug for MatrixPrediction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} cards", self.count)?;
        if self.missing_cells > 0 {
            write!(f, ", {} missing cell(s)", self.missing_cells)?;
        }
        if let Some(confidence) = self.worst_confidence {
            write!(f, ", worst confidence {confidence:.3}")?;
        }
        for (step, ms) in &self.timings {
            write!(f, ", {step} {ms:.1}ms")?;
        }
        Ok(())
    }
}
