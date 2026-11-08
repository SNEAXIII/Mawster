use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use image::DynamicImage;
use mcoc_vision::config::RustfsConfig;
use reqwest::{Client as RqwClient, Response, Url as RqwUrl, header::CONTENT_TYPE};
use rusty_s3::{Bucket, Credentials as S3Credentials, S3Action as _, UrlStyle};
use tracing::info;

const REGION: &str = "us-east-1";

const SIGN_DURATION: Duration = Duration::from_mins(1);

#[derive(Clone)]
pub struct S3 {
    client: RqwClient,
    endpoint: RqwUrl,
    credentials: S3Credentials,
}

impl S3 {
    pub fn new(config: &RustfsConfig) -> Result<Self> {
        Ok(Self {
            client: reqwest::Client::builder().build()?,
            endpoint: RqwUrl::parse(&config.endpoint)
                .context(format!("The url `{}` is not valid", config.endpoint))?,
            credentials: S3Credentials::new(&config.access_key, &config.secret_key),
        })
    }

    // Errors drop their url: the signed link would land in `vision_job.error`.
    fn bucket(&self, name: &str) -> Result<Bucket> {
        Bucket::new(
            self.endpoint.clone(),
            UrlStyle::Path,
            name.to_owned(),
            REGION,
        )
        .with_context(|| format!("invalid bucket `{name}`"))
    }

    pub async fn load_job_image(&self, bucket_name: &str, key: &str) -> Result<DynamicImage> {
        let bucket = self.bucket(bucket_name)?;
        let url = bucket
            .get_object(Some(&self.credentials), key)
            .sign(SIGN_DURATION);
        let started = Instant::now();
        let image_data = self
            .client
            .get(url)
            .send()
            .await
            .and_then(Response::error_for_status)
            .map_err(reqwest::Error::without_url)
            .with_context(|| format!("cannot download `{key}`"))?
            .bytes()
            .await?;
        let downloaded = started.elapsed();
        let image = image::load_from_memory(&image_data)?;
        let decoded = started.elapsed().saturating_sub(downloaded);
        info!(
            key,
            "image downloaded: {:.3} MB in {:.1} ms ({:.1} MB/s), decoded in {:.1} ms",
            mb(image_data.len()),
            ms(downloaded),
            mb(image_data.len()) / downloaded.as_secs_f64(),
            ms(decoded)
        );
        Ok(image)
    }

    pub async fn upload_json(&self, bucket_name: &str, key: &str, body: Vec<u8>) -> Result<()> {
        let bucket = self.bucket(bucket_name)?;
        let url = bucket
            .put_object(Some(&self.credentials), key)
            .sign(SIGN_DURATION);
        let size = body.len();
        let started = Instant::now();
        self.client
            .put(url)
            .header(CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .await
            .and_then(Response::error_for_status)
            .map_err(reqwest::Error::without_url)
            .with_context(|| format!("cannot upload `{key}`"))?;
        let uploaded = started.elapsed();
        info!(
            key,
            "result JSON uploaded: {:.3} MB in {:.1} ms ({:.1} MB/s)",
            mb(size),
            ms(uploaded),
            mb(size) / uploaded.as_secs_f64()
        );
        Ok(())
    }
}

fn ms(elapsed: Duration) -> f64 {
    elapsed.as_secs_f64() * 1000.0
}

#[allow(clippy::cast_precision_loss)]
fn mb(bytes: usize) -> f64 {
    bytes as f64 / 1_000_000.0
}
