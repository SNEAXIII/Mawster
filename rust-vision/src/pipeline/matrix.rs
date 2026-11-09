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
        gallery: &[(String, Vec<f32>)],
    ) -> anyhow::Result<Self> {
        let laps = &mut Laps::default();
        Ok(Self::with_raw(image, yolo_area, yolo_digits, gallery, laps)?.0)
    }

    /// The same run as `new`, plus the raw model outputs the bench draws and each step's time.
    pub fn with_raw(
        image: &'a DynamicImage,
        yolo_area: &mut YOLOModel,
        yolo_digits: &mut YOLOModel,
        gallery: &[(String, Vec<f32>)],
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

        let mut matrix = Self::build_card_matrix(&valid_cards);

        for row in &mut matrix {
            row.sort_by(|a, b| a.card_box.center().0.total_cmp(&b.card_box.center().0));
        }
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

    pub fn into_flat(self) -> Vec<CardDetected<'a>> {
        self.matrix
            .into_iter()
            .flatten()
            .map(|(_, card)| card)
            .collect()
    }

    /// Rows top to bottom, not yet sorted left to right.
    fn build_card_matrix(valid_cards_1d: &[CardDetected<'a>]) -> Vec<Vec<CardDetected<'a>>> {
        let center_y = |c: &CardDetected| c.card_box.center().1;
        let mut cards = valid_cards_1d.to_vec();
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

#[derive(Serialize)]
pub struct MatrixPrediction {
    pub count: usize,
    /// Lowest naming confidence of the shot; `None` without a card.
    pub worst_confidence: Option<f32>,
    pub cells: Vec<(String, CardDetectedPrediction)>,
    pub timings: Vec<(&'static str, f64)>,
}

impl From<&Matrix<'_>> for MatrixPrediction {
    fn from(matrix: &Matrix<'_>) -> Self {
        let cells: Vec<(String, CardDetectedPrediction)> = matrix
            .cells()
            .map(|(cell_name, card)| (cell_name, CardDetectedPrediction::from(card)))
            .collect();
        Self {
            count: cells.len(),
            worst_confidence: cells
                .iter()
                .map(|(_, card)| card.confidence)
                .min_by(f32::total_cmp),
            cells,
            timings: matrix.timings.clone(),
        }
    }
}

/// The worker's log line: the cards themselves stay in the JSON.
impl fmt::Debug for MatrixPrediction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} cards", self.count)?;
        if let Some(confidence) = self.worst_confidence {
            write!(f, ", worst confidence {confidence:.3}")?;
        }
        for (step, ms) in &self.timings {
            write!(f, ", {step} {ms:.1}ms")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::float_cmp)]

    use image::{Rgb, RgbImage};
    use ndarray::Array2;
    use rstest::rstest;
    use ultralytics_inference::Boxes;

    use super::*;

    /// The detector's `[x1, y1, x2, y2, conf, cls]` rows for a card at `(x, y)`: card, stars, text.
    fn parts(x: f32, y: f32) -> [[f32; 6]; 3] {
        [
            [x, y, x + 100.0, y + 100.0, 0.9, 0.0],
            [x + 10.0, y + 40.0, x + 80.0, y + 50.0, 0.9, 1.0],
            [x + 10.0, y + 70.0, x + 70.0, y + 94.0, 0.9, 2.0],
        ]
    }

    fn cards<'a>(image: &'a DynamicImage, rows: &[[f32; 6]]) -> Vec<CardDetected<'a>> {
        let data = rows.iter().flatten().copied().collect();
        let rows = Array2::from_shape_vec((rows.len(), 6), data).unwrap();
        extract_cards(read_detections(&Boxes::new(rows, (1, 1))), image)
    }

    fn all_stars_lit() -> DynamicImage {
        DynamicImage::ImageRgb8(RgbImage::from_pixel(500, 500, Rgb([255; 3])))
    }

    #[rstest]
    #[case::five_stars(5, false)]
    #[case::six_stars(6, true)]
    #[case::seven_stars(7, true)]
    fn only_six_and_seven_star_cards_are_kept(#[case] lit: u32, #[case] kept: bool) {
        let image = DynamicImage::ImageRgb8(RgbImage::from_fn(500, 500, |x, _| {
            Rgb([if x < 10 + lit * 10 { 255 } else { 0 }; 3])
        }));
        assert_eq!(cards(&image, &parts(0.0, 0.0)).len(), usize::from(kept));
    }

    #[test]
    fn each_card_takes_the_parts_inside_it() {
        let image = all_stars_lit();
        let [left_card, left_stars, left_text] = parts(0.0, 0.0);
        let [right_card, right_stars, right_text] = parts(150.0, 0.0);
        let found = cards(
            &image,
            &[
                left_card,
                right_card,
                right_stars,
                left_stars,
                right_text,
                left_text,
            ],
        );
        assert_eq!(found.len(), 2);
        for card in found {
            assert_eq!(card.stars_box.left, card.card_box.left + 10.0);
            assert_eq!(card.text_box.left, card.card_box.left + 10.0);
        }
    }

    #[rstest]
    #[case::stars(1)]
    #[case::text(2)]
    fn a_card_without_a_known_part_is_dropped(#[case] part: usize) {
        let image = all_stars_lit();
        let mut rows = parts(0.0, 0.0);
        rows[part][5] = 7.0;
        assert!(cards(&image, &rows).is_empty());
    }

    #[rstest]
    #[case::within_half_a_card(50.0, &[2])]
    #[case::past_half_a_card(51.0, &[1, 1])]
    fn rows_group_cards_by_their_height(#[case] drop: f32, #[case] sizes: &[usize]) {
        let image = all_stars_lit();
        let found = cards(&image, &[parts(120.0, drop), parts(0.0, 0.0)].concat());
        let rows = Matrix::build_card_matrix(&found);
        assert_eq!(rows.iter().map(Vec::len).collect::<Vec<_>>(), sizes);
        assert_eq!(rows[0][0].card_box.top, 0.0);
    }

    #[rstest]
    #[case::a_missed_card_leaves_a_hole(vec![vec![10.0, 110.0, 310.0], vec![110.0, 210.0]], vec![vec![0, 1, 3], vec![1, 2]])]
    #[case::a_lone_card_uses_the_other_rows_pitch(vec![vec![110.0], vec![10.0, 110.0]], vec![vec![1], vec![0, 1]])]
    #[case::uneven_steps_snap_to_the_grid(vec![vec![10.0, 110.0], vec![108.0, 212.0]], vec![vec![0, 1], vec![1, 2]])]
    #[case::no_pitch_without_neighbours(vec![vec![50.0], vec![50.0]], vec![vec![0], vec![0]])]
    #[case::no_card(vec![], vec![])]
    fn columns_come_from_the_x_centres(
        #[case] centers: Vec<Vec<f32>>,
        #[case] expected: Vec<Vec<usize>>,
    ) {
        assert_eq!(Matrix::grid_columns(&centers), expected);
    }

    #[test]
    fn a_prediction_names_each_cell_and_keeps_the_worst_confidence() {
        let image = all_stars_lit();
        let mut found = cards(&image, &[parts(0.0, 0.0), parts(150.0, 0.0)].concat());
        found[0].name_margin = 0.5;
        found[1].name_margin = 0.25;
        let matrix = Matrix {
            matrix: vec![vec![(0, found[0].clone())], vec![(3, found[1].clone())]],
            timings: vec![("yolo", 1.5)],
        };
        let prediction = MatrixPrediction::from(&matrix);
        let cells: Vec<&str> = prediction.cells.iter().map(|(c, _)| c.as_str()).collect();
        assert_eq!(cells, ["r0c0", "r1c3"]);
        assert_eq!(
            format!("{prediction:?}"),
            "2 cards, worst confidence 0.250, yolo 1.5ms"
        );
    }

    #[test]
    fn a_shot_without_a_card_has_no_worst_confidence() {
        let matrix = Matrix {
            matrix: Vec::new(),
            timings: Vec::new(),
        };
        let prediction = MatrixPrediction::from(&matrix);
        assert_eq!(prediction.worst_confidence, None);
        assert_eq!(format!("{prediction:?}"), "0 cards");
    }
}
