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

    // Public because the integration tests are a separate crate.
    pub fn for_tests() -> Self {
        Self {
            static_dir: PathBuf::from("static"),
            output_dir: PathBuf::from("build"),
            bind_url: SocketAddr::from(([0, 0, 0, 0], 8005)),
            sizes: vec![60, 110, 256],
        }
    }
}

// #[cfg(test)]
// mod tests {
//     #![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

//     use super::*;

//     /// A lookup over a fixed list, standing in for the environment.
//     fn source(pairs: &'static [(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> {
//         move |key| {
//             pairs
//                 .iter()
//                 .find(|(name, _)| *name == key)
//                 .map(|(_, value)| (*value).to_owned())
//         }
//     }

//     const MINIMAL: &[(&str, &str)] = &[
//         ("DATABASE_URL", "postgres://localhost/db"),
//         ("JWT_SECRET", "secret"),
//     ];

//     #[test]
//     fn the_two_required_settings_are_enough() {
//         let config = Config::from_source(source(MINIMAL)).unwrap();

//         assert_eq!(config.access_token_ttl, Duration::from_mins(30));
//         assert_eq!(config.refresh_token_ttl, Duration::from_hours(720));
//         assert_eq!(config.bind_addr.port(), 8001);
//         assert_eq!(config.cors_allowed_origin, "http://localhost:3000");
//         assert_eq!(config.environment, Environment::Dev);
//     }

//     #[test]
//     fn a_missing_secret_is_reported_by_name() {
//         let error = Config::from_source(source(&[("DATABASE_URL", "postgres://localhost/db")]))
//             .unwrap_err()
//             .to_string();

//         assert!(error.contains("JWT_SECRET"), "unhelpful message: {error}");
//     }

//     #[test]
//     fn an_empty_value_counts_as_absent() {
//         let error = Config::from_source(source(&[
//             ("DATABASE_URL", "postgres://localhost/db"),
//             ("JWT_SECRET", ""),
//         ]))
//         .unwrap_err()
//         .to_string();

//         assert!(error.contains("JWT_SECRET"));
//     }

//     #[test]
//     fn a_non_numeric_ttl_fails_at_boot() {
//         let error = Config::from_source(source(&[
//             ("DATABASE_URL", "postgres://localhost/db"),
//             ("JWT_SECRET", "secret"),
//             ("ACCESS_TOKEN_EXPIRE_MINUTES", "half an hour"),
//         ]))
//         .unwrap_err()
//         .to_string();

//         assert!(error.contains("ACCESS_TOKEN_EXPIRE_MINUTES"));
//     }

//     #[test]
//     fn a_bad_bind_address_fails_at_boot() {
//         let error = Config::from_source(source(&[
//             ("DATABASE_URL", "postgres://localhost/db"),
//             ("JWT_SECRET", "secret"),
//             ("BIND_ADDR", "8001"),
//         ]))
//         .unwrap_err()
//         .to_string();

//         assert!(error.contains("BIND_ADDR"));
//     }

//     #[test]
//     fn only_prod_disables_the_development_affordances() {
//         let with_env = |value: &'static str| {
//             Config::from_source(source(match value {
//                 "prod" => &[
//                     ("DATABASE_URL", "postgres://localhost/db"),
//                     ("JWT_SECRET", "secret"),
//                     ("ENV", "prod"),
//                 ],
//                 "production" => &[
//                     ("DATABASE_URL", "postgres://localhost/db"),
//                     ("JWT_SECRET", "secret"),
//                     ("ENV", "production"),
//                 ],
//                 _ => &[
//                     ("DATABASE_URL", "postgres://localhost/db"),
//                     ("JWT_SECRET", "secret"),
//                     ("ENV", "staging"),
//                 ],
//             }))
//             .unwrap()
//             .environment
//         };

//         assert_eq!(with_env("prod"), Environment::Prod);
//         assert_eq!(with_env("production"), Environment::Prod);
//         // Anything unrecognised stays permissive — this is a POC, not prod.
//         assert_eq!(with_env("staging"), Environment::Dev);
//         assert!(Environment::Dev.is_dev());
//     }

//     #[test]
//     fn custom_values_are_honoured() {
//         let config = Config::from_source(source(&[
//             ("DATABASE_URL", "postgres://localhost/db"),
//             ("JWT_SECRET", "secret"),
//             ("ACCESS_TOKEN_EXPIRE_MINUTES", "5"),
//             ("REFRESH_TOKEN_EXPIRE_DAYS", "1"),
//             ("BIND_ADDR", "127.0.0.1:9000"),
//             ("CORS_ALLOWED_ORIGIN", "https://mawster.app"),
//         ]))
//         .unwrap();

//         assert_eq!(config.access_token_ttl, Duration::from_mins(5));
//         assert_eq!(config.refresh_token_ttl, Duration::from_hours(24));
//         assert_eq!(config.bind_addr.to_string(), "127.0.0.1:9000");
//         assert_eq!(config.cors_allowed_origin, "https://mawster.app");
//     }
// }
