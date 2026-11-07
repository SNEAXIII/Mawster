use anyhow::Result;
use mcoc_vision::{
    config::{ModelPaths, get_digits_config, get_yolo_config},
    gallery,
    pipeline::{Matrix, MatrixPrediction},
};
use tokio::sync::mpsc::{Receiver, Sender};
use tracing::info;
use ultralytics_inference::YOLOModel;

use crate::job::{InferenceRequest, ResultsRequest};

/// Loads the models once, then runs every request until all senders are dropped.
pub fn serve(
    models: &ModelPaths,
    mut rx_inference: Receiver<InferenceRequest>,
    tx_results: &Sender<ResultsRequest>,
) -> Result<()> {
    let gallery = gallery::load(&models.gallery)?;
    let mut yolo_area = YOLOModel::load_with_config(&models.detector, get_yolo_config(0.7, 0.1))?;
    let mut yolo_digits = YOLOModel::load_with_config(&models.digits, get_digits_config(0.7, 0.1))?;
    while let Some((job, image)) = rx_inference.blocking_recv() {
        info!(job_id = job.vision_job.job_id, "inference started");
        let to_send = Matrix::new(&image, &mut yolo_area, &mut yolo_digits, &gallery)
            .map(|matrix| MatrixPrediction::from(&matrix));
        info!(job_id = job.vision_job.job_id, "inference finished");
        if tx_results.blocking_send((job, to_send)).is_err() {
            break;
        }
    }
    Ok(())
}
