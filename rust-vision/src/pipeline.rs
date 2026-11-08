mod matrix;

use std::time::Instant;

use ultralytics_inference::Results;

pub use matrix::*;

/// Wall time of each step, in ms, in run order.
pub struct Laps {
    last: Instant,
    pub steps: Vec<(&'static str, f64)>,
}

impl Default for Laps {
    fn default() -> Self {
        Self {
            last: Instant::now(),
            steps: Vec::new(),
        }
    }
}

impl Laps {
    /// Records the time since the previous lap under `name`.
    pub fn lap(&mut self, name: &'static str) -> f64 {
        let now = Instant::now();
        let ms = (now - self.last).as_secs_f64() * 1000.0;
        self.last = now;
        self.steps.push((name, ms));
        ms
    }

    /// Splits the last lap, a model call, into the crate's own pre/inference times and the rest.
    fn split_model(&mut self, names: [&'static str; 3], results: Option<&Results>, calls: usize) {
        let (Some(result), Some((_, wall))) = (results, self.steps.pop()) else {
            return;
        };
        #[allow(clippy::cast_precision_loss)]
        let per_call = |t: Option<f64>| t.unwrap_or(0.0) * calls as f64;
        let (pre, infer) = (
            per_call(result.speed.preprocess),
            per_call(result.speed.inference),
        );
        self.steps.extend([
            (names[0], pre),
            (names[1], infer),
            (names[2], wall - pre - infer),
        ]);
    }
}
