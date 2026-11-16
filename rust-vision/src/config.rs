//! Process configuration, read once at boot, one struct per use case: a bad
//! environment fails before the models load, not on the first job.
//!
//! Every reader takes a lookup closure rather than `std::env`, so tests don't
//! share the process environment.

use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;
use ultralytics_inference::InferenceConfig;

/// The private repo, checked out as a submodule: models and the verified screenshots.
pub const REAL_DIR: &str = "artifacts-vision/data/real";
const DETECTOR_MODEL: &str = "artifacts-vision/artifacts/yolo/best.onnx";
const DIGITS_MODEL: &str = "artifacts-vision/artifacts/ocr/digits_yolo26n_224_e140_fp16.onnx";
const GALLERY_FILE: &str = "artifacts/gallery/mosaic.bin";
const PORTRAITS_DIR: &str = "../static-assets/static/champions";
const CHAMPIONS_JSON: &str = "../api/src/fixtures/champions.json";
const CARD_BACKGROUND: &str = "src/fixtures/card_bg.png";

fn env(key: &str) -> Option<String> {
    std::env::var(key).ok()
}

/// An empty value counts as absent.
fn get(lookup: &impl Fn(&str) -> Option<String>, key: &str) -> Option<String> {
    lookup(key).filter(|value| !value.is_empty())
}

fn require(lookup: &impl Fn(&str) -> Option<String>, key: &str) -> Result<String> {
    get(lookup, key).with_context(|| format!("missing required env var {key}"))
}

fn path_or(lookup: &impl Fn(&str) -> Option<String>, key: &str, default: &str) -> PathBuf {
    PathBuf::from(get(lookup, key).unwrap_or_else(|| default.to_owned()))
}

pub fn get_yolo_config(confidence: f32, iou: f32) -> InferenceConfig {
    InferenceConfig::new()
        .with_confidence(confidence)
        .with_iou(iou)
}

/// No rect: the band crops differ in size, so the crate would warn on every batch and pad square.
pub fn get_digits_config(confidence: f32, iou: f32) -> InferenceConfig {
    get_yolo_config(confidence, iou).with_rect(false)
}

/// Where the pipeline loads its models from — the CLI and the worker alike. No
/// existence check: both open them at boot, and that error names the file.
#[derive(Debug, Clone)]
pub struct ModelPaths {
    pub detector: PathBuf,
    pub digits: PathBuf,
    pub gallery: PathBuf,
}

impl ModelPaths {
    pub fn from_env() -> Self {
        Self::from_source(env)
    }

    pub fn from_source(lookup: impl Fn(&str) -> Option<String>) -> Self {
        Self {
            detector: path_or(&lookup, "DETECTOR_MODEL", DETECTOR_MODEL),
            digits: path_or(&lookup, "DIGITS_MODEL", DIGITS_MODEL),
            gallery: path_or(&lookup, "GALLERY_FILE", GALLERY_FILE),
        }
    }
}

/// What the gallery is built from, and where it is written.
#[derive(Debug, Clone, Parser)]
#[command(about = "Embed every champion portrait into the gallery file")]
pub struct GalleryConfig {
    /// Directory of the portrait PNGs
    #[arg(long, default_value = PORTRAITS_DIR)]
    pub portraits: PathBuf,
    /// Champion list naming each portrait
    #[arg(long, default_value = CHAMPIONS_JSON)]
    pub champions: PathBuf,
    /// Background the portraits are composited on
    #[arg(long, default_value = CARD_BACKGROUND)]
    pub card_background: PathBuf,
    /// Gallery file to write
    #[arg(long, default_value = GALLERY_FILE)]
    pub output: PathBuf,
}

impl Default for GalleryConfig {
    fn default() -> Self {
        Self::parse_from(["build_gallery"])
    }
}

#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub rabbitmq_url: String,
    pub models: ModelPaths,
    pub rustfs: RustfsConfig,
}

/// Prod has no shell to read the Swarm secrets, so a var absent from the environment
/// falls back to its secret file. `%2f` names the default vhost: lapin reads `/` as an empty one.
fn env_or_secret(key: &str) -> Option<String> {
    get(&env, key).or_else(|| match key {
        "RABBITMQ_URL" => swarm_secret("mawster_rabbitmq_pass")
            .map(|pass| format!("amqp://mawster:{pass}@rabbitmq:5672/%2f")),
        "RUSTFS_ACCESS_KEY" => swarm_secret("mawster_rustfs_access_key"),
        "RUSTFS_SECRET_KEY" => swarm_secret("mawster_rustfs_secret_key"),
        _ => None,
    })
}

fn swarm_secret(name: &str) -> Option<String> {
    std::fs::read_to_string(format!("/run/secrets/{name}"))
        .ok()
        .map(|value| value.trim_end().to_owned())
}

impl WorkerConfig {
    pub fn from_env() -> Result<Self> {
        Self::from_source(env_or_secret)
    }

    pub fn from_source(lookup: impl Fn(&str) -> Option<String>) -> Result<Self> {
        Ok(Self {
            rabbitmq_url: require(&lookup, "RABBITMQ_URL")?,
            rustfs: RustfsConfig::from_source(&lookup)?,
            models: ModelPaths::from_source(lookup),
        })
    }
}

#[derive(Debug, Clone)]
pub struct RustfsConfig {
    pub endpoint: String,
    pub access_key: String,
    pub secret_key: String,
}

impl RustfsConfig {
    pub fn from_source(lookup: impl Fn(&str) -> Option<String>) -> Result<Self> {
        Ok(Self {
            endpoint: get(&lookup, "RUSTFS_ENDPOINT")
                .unwrap_or_else(|| "http://rustfs:9000".to_owned()),
            access_key: require(&lookup, "RUSTFS_ACCESS_KEY")?,
            secret_key: require(&lookup, "RUSTFS_SECRET_KEY")?,
        })
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]

    use super::*;

    fn source(pairs: &'static [(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> {
        move |key| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        }
    }

    #[test]
    fn model_paths_default_to_the_tracked_artifacts() {
        let models = ModelPaths::from_source(source(&[("DIGITS_MODEL", "/models/digits.onnx")]));
        assert_eq!(models.digits, PathBuf::from("/models/digits.onnx"));
        assert_eq!(models.gallery, PathBuf::from(GALLERY_FILE));
    }

    #[test]
    fn gallery_paths_default_to_the_repo_and_follow_the_arguments() {
        let config = GalleryConfig::parse_from(["build_gallery", "--portraits", "/portraits"]);
        assert_eq!(config.portraits, PathBuf::from("/portraits"));
        assert_eq!(config.champions, PathBuf::from(CHAMPIONS_JSON));
        assert_eq!(config.output, PathBuf::from(GALLERY_FILE));
    }

    #[test]
    fn a_missing_or_empty_required_var_fails_the_boot() {
        const BROKER: (&str, &str) = ("RABBITMQ_URL", "amqp://x");
        const ACCESS: (&str, &str) = ("RUSTFS_ACCESS_KEY", "x");
        const SECRET: (&str, &str) = ("RUSTFS_SECRET_KEY", "x");
        let lookups: [(&'static [(&str, &str)], &str); 4] = [
            (&[ACCESS, SECRET], "RABBITMQ_URL"),
            (&[("RABBITMQ_URL", ""), ACCESS, SECRET], "RABBITMQ_URL"),
            (&[BROKER, SECRET], "RUSTFS_ACCESS_KEY"),
            (
                &[BROKER, ACCESS, ("RUSTFS_SECRET_KEY", "")],
                "RUSTFS_SECRET_KEY",
            ),
        ];
        for (pairs, key) in lookups {
            let err = WorkerConfig::from_source(source(pairs)).unwrap_err();
            assert_eq!(err.to_string(), format!("missing required env var {key}"));
        }
    }

    #[test]
    fn the_required_vars_are_enough_to_boot() {
        let config = WorkerConfig::from_source(source(&[
            ("RABBITMQ_URL", "amqp://x"),
            ("RUSTFS_ACCESS_KEY", "x"),
            ("RUSTFS_SECRET_KEY", "x"),
        ]));
        assert_eq!(config.unwrap().rabbitmq_url, "amqp://x");
    }
}
