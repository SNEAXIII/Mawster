use anyhow::Result;
use image::DynamicImage;
use lapin::message::Delivery;
use mcoc_vision::pipeline::MatrixPrediction;
use serde::Deserialize;

/// The message the API publishes on `vision.jobs`.
#[derive(Debug, Deserialize)]
pub struct VisionJob {
    pub job_id: String,
    pub import_id: String,
    pub bucket: String,
    pub object_key: String,
}

/// A job being worked on: what to do, and the handle to ack it once done.
pub struct InFlightJob {
    pub vision_job: VisionJob,
    pub delivery: Delivery,
}

pub type InferenceRequest = (InFlightJob, DynamicImage);
pub type ResultsRequest = (InFlightJob, Result<MatrixPrediction>);
