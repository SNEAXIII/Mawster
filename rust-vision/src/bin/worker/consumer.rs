use anyhow::{Context, Result};
use futures_lite::StreamExt;
use lapin::Connection;
use lapin::options::{BasicConsumeOptions, BasicQosOptions, BasicRejectOptions};
use lapin::types::FieldTable;
use tokio::sync::mpsc::Sender;
use tracing::{error, info};

use crate::PREFETCH;
use crate::job::{InFlightJob, InferenceRequest, ResultsRequest, VisionJob};
use crate::s3::S3;

const QUEUE_JOBS: &str = "vision.jobs";

pub async fn consume(
    tx_inference: &Sender<InferenceRequest>,
    tx_results: Sender<ResultsRequest>,
    connection: &Connection,
    s3: &S3,
) -> Result<()> {
    let channel = connection.create_channel().await?;
    channel
        .basic_qos(PREFETCH, BasicQosOptions::default())
        .await?;

    let mut consumer = channel
        .basic_consume(
            QUEUE_JOBS.into(),
            "mcoc-vision-rs".into(),
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
        .context("cannot consume vision.jobs: has the API declared the topology?")?;
    info!("waiting for jobs on {QUEUE_JOBS}");

    while let Some(delivery) = consumer.next().await {
        let delivery = delivery?;
        let Ok(vision_job) = serde_json::from_slice::<VisionJob>(&delivery.data) else {
            error!("malformed job, dead-lettering it");
            delivery
                .reject(BasicRejectOptions { requeue: false })
                .await?;
            continue;
        };
        info!(
            job_id = vision_job.job_id,
            import_id = vision_job.import_id,
            bucket = vision_job.bucket,
            object_key = vision_job.object_key,
            "job received"
        );

        let response = s3
            .load_job_image(&vision_job.bucket, &vision_job.object_key)
            .await;
        let job = InFlightJob {
            vision_job,
            delivery,
        };
        match response {
            Ok(image) => tx_inference
                .send((job, image))
                .await
                .context("inference thread is gone")?,
            Err(err) => {
                info!(job_id = job.vision_job.job_id, "skipping inference");
                tx_results.send((job, Err(err))).await?;
            }
        }
    }
    Ok(())
}
