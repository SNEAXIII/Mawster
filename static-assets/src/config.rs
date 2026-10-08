use anyhow::{Context, Result};
use std::{net::SocketAddr, path::PathBuf};

#[derive(Debug, Clone)]
pub struct Config {
    pub static_dir: PathBuf,
    pub output_dir: PathBuf,
    pub bind_url: SocketAddr,
    // Keep in sync with THUMBNAIL_SIZES (front/app/services/champions.ts).
    pub sizes: Vec<u32>,
}

impl Config {
    /// Read the configuration from the process environment.
    pub fn from_env() -> Result<Self> {
        Self::from_source(|key| std::env::var(key).ok())
    }

    pub fn from_source(lookup: impl Fn(&str) -> Option<String>) -> Result<Self> {
        let get = |key: &str| lookup(key).filter(|value| !value.is_empty());
        let static_dir: PathBuf = get("STATIC_DIR")
            .unwrap_or_else(|| "static".to_owned())
            .parse()
            .context("STATIC_DIR is not a valid folder path")?;
        anyhow::ensure!(
            static_dir.is_dir(),
            "STATIC_DIR {} is not a directory",
            static_dir.display()
        );
        Ok(Self {
            static_dir,
            output_dir: get("OUTPUT_DIR")
                .unwrap_or_else(|| "build".to_owned())
                .parse()
                .context("OUTPUT_DIR is not a valid folder path")?,
            bind_url: get("BIND_URL")
                .unwrap_or_else(|| "0.0.0.0:8005".to_owned())
                .parse()
                .context("BIND_URL is not a valid socket address")?,
            sizes: get("IMAGE_SIZES")
                .unwrap_or_else(|| "60,110,256".to_owned())
                .split(',')
                .map(|size| size.trim().parse())
                .collect::<Result<_, _>>()
                .context("IMAGE_SIZES must be comma-separated integers, e.g. 60,110")?,
        })
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

    use rstest::rstest;

    use super::*;

    fn source(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        move |key| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        }
    }

    /// Points STATIC_DIR at the crate root, so no test depends on the working directory.
    const MANIFEST_DIR: &str = env!("CARGO_MANIFEST_DIR");

    /// from_source over `pairs`, with STATIC_DIR defaulting to the crate root.
    fn config_with(pairs: &[(&str, &str)]) -> Result<Config> {
        let lookup = source(pairs);
        Config::from_source(|key| {
            lookup(key).or_else(|| (key == "STATIC_DIR").then(|| MANIFEST_DIR.to_owned()))
        })
    }

    #[test]
    fn defaults_apply_when_nothing_is_set() {
        let config = config_with(&[]).unwrap();
        assert_eq!(config.output_dir, PathBuf::from("build"));
        assert_eq!(config.bind_url, SocketAddr::from(([0, 0, 0, 0], 8005)));
        assert_eq!(config.sizes, vec![60, 110, 256]);
    }

    #[test]
    fn an_empty_value_counts_as_absent() {
        let config = config_with(&[("IMAGE_SIZES", "")]).unwrap();
        assert_eq!(config.sizes, vec![60, 110, 256]);
    }

    #[test]
    fn image_sizes_tolerate_spaces() {
        let config = config_with(&[("IMAGE_SIZES", "60, 110")]).unwrap();
        assert_eq!(config.sizes, vec![60, 110]);
    }

    #[rstest]
    #[case::not_a_number("60,abc")]
    #[case::empty_middle("60,,110")]
    #[case::trailing_comma("60,110,")]
    fn malformed_image_sizes_are_rejected_by_name(#[case] value: &str) {
        let error = config_with(&[("IMAGE_SIZES", value)])
            .unwrap_err()
            .to_string();
        assert!(error.contains("IMAGE_SIZES"), "{error}");
    }

    #[rstest]
    #[case::only_port("8005")]
    #[case::only_url("localhost")]
    #[case::reverse_order("8005:localhost")]
    #[case::port_too_long("localhost:77777")]
    #[case::missing_port("localhost:")]
    fn a_bad_bind_url_is_rejected_by_name(#[case] value: &str) {
        let error = config_with(&[("BIND_URL", value)]).unwrap_err().to_string();
        assert!(error.contains("BIND_URL"), "{error}");
    }

    #[rstest]
    #[case::non_existant("non_existant")]
    #[case::is_a_file("Cargo.toml")]
    fn a_static_dir_that_is_not_a_directory_is_rejected(#[case] value: &str) {
        let error = config_with(&[("STATIC_DIR", value)])
            .unwrap_err()
            .to_string();
        assert!(
            error.contains(&format!("STATIC_DIR {value} is not a directory")),
            "{error}"
        );
    }

    #[rstest]
    #[case::all_custom(
        &[
            ("STATIC_DIR", "src"),
            ("OUTPUT_DIR", "out"),
            ("BIND_URL", "127.0.0.1:9000"),
            ("IMAGE_SIZES", "110,256"),
        ],
        "src",
        "out",
        "127.0.0.1:9000",
        &[110, 256],
    )]
    #[case::all_custom_default_url(
        &[
            ("STATIC_DIR", "src"),
            ("OUTPUT_DIR", "out"),
            ("IMAGE_SIZES", "110,256"),
        ],
        "src",
        "out",
        "0.0.0.0:8005",
        &[110, 256],
    )]
    #[case::all_custom_huge_number_of_sizes(
        &[
            ("STATIC_DIR", "src"),
            ("OUTPUT_DIR", "out"),
            ("BIND_URL", "127.0.0.1:9000"),
            ("IMAGE_SIZES", "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16"),
        ],
        "src",
        "out",
        "127.0.0.1:9000",
        &[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
    )]
    fn custom_values_are_honoured(
        #[case] pairs: &[(&str, &str)],
        #[case] static_dir: &str,
        #[case] output_dir: &str,
        #[case] bind_url: &str,
        #[case] sizes: &[u32],
    ) {
        let config = config_with(pairs).unwrap();
        assert_eq!(config.static_dir, PathBuf::from(static_dir));
        assert_eq!(config.output_dir, PathBuf::from(output_dir));
        assert_eq!(config.bind_url.to_string(), bind_url);
        assert_eq!(config.sizes, sizes);
    }
}
