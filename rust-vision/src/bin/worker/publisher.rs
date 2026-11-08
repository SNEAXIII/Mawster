use anyhow::{Result, ensure};
use lapin::options::{BasicAckOptions, BasicNackOptions, BasicPublishOptions};
use lapin::{BasicProperties, Channel};
use mcoc_vision::pipeline::MatrixPrediction;
use serde_json::{Value, json};
use tokio::sync::mpsc::Receiver;
use tracing::{error, info};

use crate::{
    job::{ResultsRequest, VisionJob},
    s3::S3,
};

const EXCHANGE: &str = "mcoc.vision";
const ROUTING_KEY_RESULT: &str = "result";
/// Same cap as the Python worker: the text lands in `vision_job.error`.
const MAX_ERROR_CHARS: usize = 500;

/// A failed job is reported and acked, the API owns the retry. Only a failed publish is
/// requeued: the pipeline already ran, and its result must not vanish.
pub async fn publish(
    mut rx_results: Receiver<ResultsRequest>,
    s3: S3,
    channel: Channel,
) -> Result<()> {
    while let Some((job, outcome)) = rx_results.recv().await {
        info!(job_id = job.vision_job.job_id, "publish started");
        let result = build_result(&job.vision_job, outcome, &s3).await;
        let body = serde_json::to_vec(&result)?;
        let job_id = job.vision_job.job_id;
        match publish_result(&channel, &job_id, &body).await {
            Ok(()) => {
                job.delivery.ack(BasicAckOptions::default()).await?;
                info!(job_id, "job acked");
            }
            Err(err) => {
                error!(job_id, "cannot publish the result, requeuing: {err:#}");
                job.delivery
                    .nack(BasicNackOptions {
                        requeue: true,
                        ..Default::default()
                    })
                    .await?;
            }
        }
    }
    Ok(())
}

/// Stores the JSON and returns the message for the API; a failed upload is a failed job.
// ponytail: predictions lack champion_class and reranked: the API defaults them.
// Add them to CardDetectedPrediction.
async fn build_result(job: &VisionJob, outcome: Result<MatrixPrediction>, s3: &S3) -> Value {
    let result_key = format!("imports/{}/{}/result.json", job.import_id, job.job_id);
    let stored = async {
        let prediction = outcome?;
        s3.upload_json(&job.bucket, &result_key, serde_json::to_vec(&prediction)?)
            .await?;
        anyhow::Ok(prediction)
    }
    .await;
    let job_id = &job.job_id;
    match stored {
        Ok(prediction) => {
            info!(job_id, "job done: {prediction:?}");
            let predictions: Vec<_> = prediction.cells.iter().map(|(_, card)| card).collect();
            json!({
                "job_id": job_id,
                "import_id": job.import_id,
                "status": "done",
                "error": null,
                "result_key": result_key,
                "predictions": predictions,
            })
        }
        Err(err) => {
            error!(job_id, "job failed: {err:#}");
            let error: String = format!("{err:#}").chars().take(MAX_ERROR_CHARS).collect();
            json!({
                "job_id": job_id,
                "import_id": job.import_id,
                "status": "failed",
                "error": error,
                "result_key": null,
                "predictions": [],
            })
        }
    }
}

/// Returns once the broker has confirmed the message: the job is acked only after that.
async fn publish_result(channel: &Channel, job_id: &str, body: &[u8]) -> Result<()> {
    let properties = BasicProperties::default()
        .with_content_type("application/json".into())
        .with_delivery_mode(2)
        .with_message_id(job_id.into());
    let confirmation = channel
        .basic_publish(
            EXCHANGE.into(),
            ROUTING_KEY_RESULT.into(),
            BasicPublishOptions::default(),
            body,
            properties,
        )
        .await?
        .await?;
    ensure!(
        confirmation.is_ack(),
        "broker refused the result of job {job_id}"
    );
    Ok(())
}
