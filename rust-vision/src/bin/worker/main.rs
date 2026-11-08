mod consumer;
mod inference;
mod job;
mod publisher;
mod s3;
use crate::consumer::consume;
use crate::inference::serve;
use crate::job::{InferenceRequest, ResultsRequest};
use crate::publisher::publish;
use crate::s3::S3;
use anyhow::{Context, Result};
use lapin::options::ConfirmSelectOptions;
use lapin::{Connection, ConnectionProperties};
use mcoc_vision::config::WorkerConfig;
use std::thread;
use tokio::sync::mpsc::channel;
use tracing::info;

pub const PREFETCH: u16 = 5;

const INFERENCE_CHANNEL: usize = 2;

const RESULTS_CHANNEL: usize = 2;

/// As PID 1 the worker gets no default SIGTERM handler: Swarm would wait 10 s, then kill it.
#[cfg(unix)]
async fn terminated() {
    use tokio::signal::unix::{SignalKind, signal};
    match signal(SignalKind::terminate()) {
        Ok(mut sigterm) => {
            sigterm.recv().await;
        }
        Err(_) => std::future::pending::<()>().await,
    }
}

#[cfg(not(unix))]
async fn terminated() {
    std::future::pending::<()>().await;
}

#[tokio::main]
async fn main() -> Result<()> {
    // No .env in the container: the stack injects the variables.
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt().init();

    let config = WorkerConfig::from_env()?;
    let models = config.models.clone();
    let s3 = S3::new(&config.rustfs)?;
    let connection = Connection::connect(&config.rabbitmq_url, ConnectionProperties::default())
        .await
        .context("cannot reach RabbitMQ")?;
    let results_channel = connection.create_channel().await?;
    results_channel
        .confirm_select(ConfirmSelectOptions::default())
        .await?;
    info!(
        prefetch = PREFETCH, inference_channel = INFERENCE_CHANNEL,
        results_channel = RESULTS_CHANNEL, "worker capacities"
    );

    let (tx_inference, rx_inference) = channel::<InferenceRequest>(INFERENCE_CHANNEL);
    let (tx_results, rx_results) = channel::<ResultsRequest>(RESULTS_CHANNEL);
    let tx_failed = tx_results.clone();

    let handle_infer_thread = thread::spawn(move || serve(&models, rx_inference, &tx_results));
    let publisher = tokio::spawn(publish(rx_results, s3.clone(), results_channel));
    let fed = tokio::select! {
        fed = consume(&tx_inference, tx_failed, &connection, &s3) => fed,
        () = terminated() => {
            info!("SIGTERM: unacked jobs go back to the queue");
            return Ok(());
        }
    };

    drop(tx_inference);

    // Joined first: a dead channel is only the symptom of the step's own error.
    handle_infer_thread
        .join()
        .map_err(|_| anyhow::anyhow!("worker panicked"))??;
    publisher.await??;
    fed
}
